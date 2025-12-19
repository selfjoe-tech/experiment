// app/components/media/VirtualizedSquareGrid.tsx
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props<T> = {
  items: T[];
  cols: number; // 3 mobile, 4 desktop
  gapPx: number; // 4 for gap-1, 8 for gap-2
  overscanRows?: number;
  gridClassName?: string;
  renderItem: (item: T, index: number) => React.ReactNode;

  // ✅ bonus: lets YOU control keys without stuffing keys inside renderItem
  getKey?: (item: T, index: number) => React.Key;
};

export default function VirtualizedSquareGrid<T>({
  items,
  cols,
  gapPx,
  overscanRows = 2,
  gridClassName = "",
  renderItem,
  getKey,
}: Props<T>) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [hostWidth, setHostWidth] = useState(0);
  const [hostTop, setHostTop] = useState(0);
  const [range, setRange] = useState({ startRow: 0, endRow: 0 });

  const totalRows = useMemo(() => Math.ceil(items.length / cols), [items.length, cols]);

  // Compute tile size (square)
  const tileSize = useMemo(() => {
    if (!hostWidth) return 0;
    const totalGap = gapPx * (cols - 1);
    return Math.max(0, (hostWidth - totalGap) / cols);
  }, [hostWidth, cols, gapPx]);

  const rowStride = useMemo(() => (tileSize ? tileSize + gapPx : 0), [tileSize, gapPx]);

  // Measure width + top position
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setHostWidth(rect.width);
      setHostTop(rect.top + window.scrollY);
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Update hostTop when content above changes (new batches)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHostTop(rect.top + window.scrollY);
  }, [items.length]);

  // Update visible range on scroll (rAF throttled)
  useEffect(() => {
    if (!rowStride || !totalRows) return;

    let ticking = false;

    const update = () => {
      ticking = false;

      const scrollY = window.scrollY;
      const viewTop = scrollY - hostTop;
      const viewBottom = viewTop + window.innerHeight;

      const rawStart = Math.floor(viewTop / rowStride) - overscanRows;
      const rawEnd = Math.ceil(viewBottom / rowStride) + overscanRows;

      const startRow = clamp(rawStart, 0, Math.max(0, totalRows - 1));
      const endRow = clamp(rawEnd, 0, Math.max(0, totalRows - 1));

      setRange((prev) =>
        prev.startRow === startRow && prev.endRow === endRow ? prev : { startRow, endRow }
      );
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [rowStride, totalRows, hostTop, overscanRows]);

  // If we haven't measured yet, render a small non-virtual preview (bonus: avoids “one-row flash”)
  if (!hostWidth) {
    const previewCount = Math.min(items.length, cols * 8);
    return (
      <div ref={hostRef} className="w-full">
        <div
          className={gridClassName}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: `${gapPx}px`,
          }}
        >
          {items.slice(0, previewCount).map((item, i) => (
            <React.Fragment key={getKey ? getKey(item, i) : i}>
              {renderItem(item, i)}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // Slice items for visible rows
  const startIndex = range.startRow * cols;
  const endIndex = Math.min(items.length, (range.endRow + 1) * cols);
  const visible = items.slice(startIndex, endIndex);

  const paddingTop = range.startRow * rowStride;
  const paddingBottom = Math.max(0, (totalRows - range.endRow - 1) * rowStride);

  return (
    <div ref={hostRef} className="w-full">
      <div style={{ paddingTop, paddingBottom }}>
        <div
          className={gridClassName}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: `${gapPx}px`,
            // ✅ bonus: forces true square cells even if child forgets aspect-square
            gridAutoRows: `${tileSize}px`,
          }}
        >
          {visible.map((item, i) => {
            const absoluteIndex = startIndex + i;
            const key = getKey ? getKey(item, absoluteIndex) : absoluteIndex;
            return (
              <React.Fragment key={key}>
                {renderItem(item, absoluteIndex)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
