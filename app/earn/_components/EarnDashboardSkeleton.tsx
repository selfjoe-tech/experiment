export default function EarnDashboardSkeleton() {
  return <div className="animate-pulse">
    <div className="h-4 w-36 rounded bg-white/[.08]"/>
    <div className="mt-4 h-16 w-[260px] rounded bg-white/[.08]"/>
    <div className="mt-8 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
      {[0,1,2].map(i => <div key={i} className="h-10 rounded bg-white/[.05]"/>)}
    </div>
    <div className="mt-10 h-px bg-white/10"/>
    <div className="mt-8 h-24 rounded bg-white/[.05]"/>
    <div className="mt-8 h-px bg-white/10"/>
    <div className="mt-8 space-y-4">{[0,1,2].map(i => <div key={i} className="h-14 rounded bg-white/[.05]"/>)}</div>
  </div>;
}
