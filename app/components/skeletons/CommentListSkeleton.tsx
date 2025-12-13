export function CommentListSkeleton({
  level = 0,
  count = 4,
}: {
  level?: number;
  count?: number;
}) {
  return (
    <div
      className={
        level > 0
          ? "pl-4 border-l border-white/10 space-y-2"
          : "space-y-2"
      }
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex gap-2 text-xs animate-pulse">
          {/* avatar */}
          <div className="mt-1 h-7 w-7 rounded-full bg-white/10 shrink-0" />

          {/* body */}
          <div className="flex-1 space-y-1.5">
            {/* username */}
            <div className="h-3 w-24 rounded bg-white/20" />

            {/* comment lines */}
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-3/4 rounded bg-white/10" />

            {/* actions: like + reply */}
            <div className="mt-1 flex items-center gap-3">
              <div className="h-3 w-10 rounded-full bg-white/10" />
              <div className="h-3 w-8 rounded-full bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
