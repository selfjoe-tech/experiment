export function VideoCardSkeleton() {
  return (
    <div
      className="
        relative
        h-full
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      "
    >
      {/* MAIN VIDEO AREA */}
      <div className="relative h-full flex items-center justify-center">
        <div
          className="
            rounded-3xl
            bg-neutral-800/80
            border border-white/10
            h-full
            w-[40vh]
            max-w-[420px]
            animate-pulse
          "
        >
          {/* fake play icon */}
          <div className="h-full w-full flex items-center justify-center">
            
          </div>
        </div>
      </div>

      {/* RIGHT-SIDE ACTIONS */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
            <div className="h-2 w-8 rounded-full bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      {/* BOTTOM INFO + SCRUBBER */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-3">
        {/* creator row */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/15 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-16 rounded-full bg-white/5 animate-pulse" />
          </div>
          <div className="h-7 w-20 rounded-full bg-white/10 animate-pulse" />
        </div>

        {/* description lines */}
        <div className="space-y-2">
          <div className="h-3 w-52 rounded-full bg-white/10 animate-pulse" />
          <div className="h-3 w-40 rounded-full bg-white/5 animate-pulse" />
        </div>

        {/* scrubber */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-white/20 animate-pulse" />
          </div>
          <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* GRADIENT OVERLAYS */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
    </div>
  );
}
