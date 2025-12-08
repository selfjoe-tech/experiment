"use client";

import Link from "next/link";

export default function ExploreTabs({ active }: { active: "gifs" | "images" | "creators" | "niches" }) {
  const tabs: { key: typeof active; label: string }[] = [
    { key: "gifs", label: "GIFs" },
    { key: "images", label: "Images" },
    { key: "creators", label: "Creators" },
    { key: "niches", label: "Niches" },
  ];

  return (
    <div className="flex items-center gap-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/explore/${t.key}`}
          className={`pb-2 text-sm ${
            active === t.key
              ? "font-semibold text-white border-b-2 border-white"
              : "text-white/70 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
