"use client";

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";

export type SortKey = "trending" | "newest" | "views";
const LABELS: Record<SortKey,string> = {
  trending: "Trending",
  newest: "Latest",
  views: "Most viewed",
};

export default function SortDropdown({value,onChange}:{value:SortKey;onChange:(v:SortKey)=>void}) {
  return <DropdownMenu>
    <DropdownMenuTrigger aria-label={`Sort content by ${LABELS[value]}`}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[.035] px-3 text-xs font-medium text-white/80 outline-none transition hover:border-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">
      <SlidersHorizontal size={14} aria-hidden="true"/>
      <span className="hidden sm:inline">{LABELS[value]}</span>
      <span className="sm:hidden">Sort</span>
      <ChevronDown size={13} aria-hidden="true"/>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-40 border-white/15 bg-[#17181d] p-1 text-white">
      {(["trending","newest","views"] as SortKey[]).map(key=>
        <DropdownMenuItem key={key} onClick={()=>onChange(key)}
          className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs focus:bg-white/10 focus:text-white">
          {LABELS[key]} {key===value && <Check size={15}/>}
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>;
}
