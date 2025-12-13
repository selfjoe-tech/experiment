"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

export type SortKey = "trending" | "newest" | "views";
const LABELS: Record<SortKey, string> = {
  trending: "Trending",
  newest: "Newest",
  views: "Most Viewed",
};

export default function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <DropdownMenu>
  <DropdownMenuTrigger
    className="text-sm rounded-full px-3 py-1.5 border border-white/10 hover:bg-white/10 flex items-center gap-1"
    aria-label={`Sort by ${LABELS[value]}`}  // accessible, but not visible
  >
    <span>Sort</span> <span>by</span> <ChevronDown className="h-4 w-4" />
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" className="min-w-44 bg-black text-white">
    {(['trending','newest','views'] as SortKey[]).map(k => (
      <DropdownMenuItem 
      key={k}
      onClick={() => onChange(k)}>
        <div className="flex gap-1">
          {k === value && <Check className=" h-4 w-4" />}
          {LABELS[k]}
        </div>
        
  
</DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>

  );
}
