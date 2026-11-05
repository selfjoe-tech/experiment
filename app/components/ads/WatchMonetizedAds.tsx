"use client";

import { useEffect, useRef } from "react";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import { PAYABLE_AD_ZONES } from "@/lib/client/watchAdZones";

const MIN_WAIT_MS = 4000;
const MAX_WAIT_MS = 45000;

/**
 * Conservative, best-effort evidence that all four Watch-page publisher
 * creatives have actually loaded. A queued <ins>, a script download or an
 * empty placeholder does NOT count. No claim is emitted if creative load
 * events are unavailable. Browser signals cannot replace reconciliation with
 * the ad network when making actual PayPal payments.
 */
export default function WatchMonetizedAds({ mediaId }: { mediaId: number }) {
  const root = useRef<HTMLDivElement>(null);
  const session = useRef<string | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    let alive = true;
    let startedAt = performance.now();
    let timeout: number | undefined;
    let checkTimer: number | undefined;
    const loaded = new Set<number>();
    const watched = new WeakSet<Element>();
    const watcher = new MutationObserver(() => inspect());

    const inspect = () => {
      const container = root.current;
      if (!container) return;
      for (const zone of PAYABLE_AD_ZONES) {
        if (loaded.has(zone)) continue;
        const ins = container.querySelector(`ins[id="${zone}"]`);
        if (!ins) continue;
        // Network creative can be nested under vendor-generated wrappers.
        const elements = ins.querySelectorAll("iframe,img");
        elements.forEach(el => {
          if (watched.has(el)) return;
          watched.add(el);
          const complete = () => {
            if (!alive || !el.isConnected) return;
            if (el instanceof HTMLImageElement && el.naturalWidth <= 0) return;
            loaded.add(zone);
            void attemptCredit();
          };
          el.addEventListener("load", complete, { once: true });
          if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) complete();
        });
      }
      void attemptCredit();
    };

    const attemptCredit = async () => {
      if (!alive || submitted.current || !session.current ||
          PAYABLE_AD_ZONES.some(zone => !loaded.has(zone))) return;
      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_WAIT_MS) {
        if (checkTimer) window.clearTimeout(checkTimer);
        checkTimer = window.setTimeout(() => { void attemptCredit(); }, MIN_WAIT_MS - elapsed + 100);
        return;
      }
      submitted.current = true;
      try {
        await fetch("/api/watch-earnings/complete", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.current, zones: [...loaded] }),
        });
      } catch {
        // Fail closed: no phantom earnings or automatic client-side retries.
      }
    };

    const init = async () => {
      try {
        const response = await fetch("/api/watch-earnings/start", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId }),
        });
        if (!response.ok) return;
        const result = (await response.json()) as { eligible?: boolean; sessionId?: string };
        if (!alive || !result.eligible || !result.sessionId) return;
        session.current = result.sessionId;
        startedAt = performance.now();
        inspect();
      } catch {
        // Blocking or failed tracking should not interrupt watching.
      }
    };

    submitted.current = false;
    session.current = null;
    const host = root.current;
    if (host) watcher.observe(host, { subtree: true, childList: true });
    inspect();
    void init();
    timeout = window.setTimeout(() => {
      alive = false;
      watcher.disconnect();
    }, MAX_WAIT_MS);
    return () => {
      alive = false;
      watcher.disconnect();
      if (timeout) window.clearTimeout(timeout);
      if (checkTimer) window.clearTimeout(checkTimer);
    };
  }, [mediaId]);

  return <div ref={root}>
    <StaticPageAdPair />
  </div>;
}
