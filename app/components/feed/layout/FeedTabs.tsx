import React from "react";
import type { FeedTab } from "@/app/components/feed/types";

type Props = {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
};

export default function FeedTabs({ activeTab, onTabChange }: Props) {
  const tabs: { value: FeedTab; label: string }[] = [
    { value: "forYou", label: "For You" },
    { value: "trending", label: "Trending" },
  ];

  return (
    <div className="flex items-center text-xs bg-white/10 rounded-full p-1">
      {tabs.map((tab) => {
        const active = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`px-3 py-1 rounded-full transition-colors ${
              active ? "bg-white text-black font-semibold" : "text-white/70"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
