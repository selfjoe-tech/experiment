"use client";

import { Clapperboard, Grid3X3, UsersRound, Hash } from "lucide-react";

type ExploreTab = "gifs" | "images" | "creators" | "niches";

const TABS = [
  { key: "gifs", label: "Videos", icon: Clapperboard },
  { key: "images", label: "Photos", icon: Grid3X3 },
  { key: "creators", label: "Creators", icon: UsersRound },
  { key: "niches", label: "Niches", icon: Hash },
] as const;

export default function ExploreTabs({ active }: { active: ExploreTab }) {
  return (
    <nav aria-label="Explore categories" className="flex min-w-0 flex-1 gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-8">
      {TABS.map(({key,label,icon:Icon}) => {
        const selected = active === key;
        return <a key={key} href={`/explore/${key}`} aria-current={selected ? "page" : undefined}
          className={`group relative flex h-12 shrink-0 items-center gap-2 border-b-2 px-0.5 text-[13px] font-semibold transition-colors sm:text-sm ${selected ? "border-white text-white" : "border-transparent text-white/45 hover:text-white/85"}`}>
          <Icon size={17} strokeWidth={selected ? 2.3 : 1.75} aria-hidden="true"/>
          <span>{label}</span>
        </a>;
      })}
    </nav>
  );
}
