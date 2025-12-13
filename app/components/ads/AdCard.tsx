"use client";

import { buildPublicUrl } from "@/lib/actions/mediaFeed";
import { supabase } from "@/lib/supabaseClient";
import { ArrowUpRightFromSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { fetchRandomMobileBannerAd, type SidebarAd } from "@/lib/actions/ads";


const ACCENT_START = "#a855f7";
const ACCENT_END = "#ec4899";

export function AdCard({ name }: { name: string }) {
  const router = useRouter();

  return (
    <Link href="/ads" className="flex flex-col gap-2">
      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg shadow-pink-500/10">
        <div
          className="h-40 w-full"
          style={{
            backgroundImage: `radial-gradient(circle at 0% 0%, ${ACCENT_START}, transparent 55%), radial-gradient(circle at 100% 100%, ${ACCENT_END}, transparent 55%), linear-gradient(135deg, #020617, #0f172a)`,
          }}
        />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{name}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/60">
              Ad Preview
            </span>
          </div>
          <p className="text-xs text-white/70">
            Your brand showcased above the feed on every refresh, right where
            users start scrolling.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              router.push("/ads");
            }}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full bg-white text-black py-1.5 hover:bg-white/90"
          >
            Visit Ads Page
            <ArrowUpRightFromSquare size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}


export function MobileAdCard({ name }: { name: string }) {
  const router = useRouter();

  return (
    <Link href="/ads" className="flex flex-col gap-2">
        <div
          className="text-nowrap h-40 gap-2 w-full flex rounded-[50px] items-center justify-center text-2xl"
          style={{
            backgroundImage: `radial-gradient(circle at 0% 0%, ${ACCENT_START}, transparent 55%), radial-gradient(circle at 100% 100%, ${ACCENT_END}, transparent 55%), linear-gradient(135deg, #020617, #0f172a)`,
          }}
        >
            Your Banner on mobile will look like this<ArrowUpRightFromSquare size={50} />
        </div>
        
    </Link>
  );
}



export function MobileAd({ name }: { name: string }) {
  const [ad, setAd] = useState<SidebarAd | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const result = await fetchRandomMobileBannerAd();
      if (!cancelled) {
        setAd(result);
      }
    } catch (err) {
      console.error("MobileAd thrown error", err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);

  const hrefRaw =
    ad?.landing_url && ad.landing_url.trim().length > 0
      ? ad.landing_url.trim()
      : "/ads";

  const href = hrefRaw;
  const isExternal =
    href.startsWith("http://") || href.startsWith("https://");

  const labelText = ad
    ? `Visit ${ad.owner_username || "this sponsor"}`
    : "Your Ad on mobile will look like this";

  const mediaUrl =
    ad?.storage_path != null ? buildPublicUrl(ad.storage_path) : null;

  // If loading OR no valid ad/image → default pill
  if (loading || !ad || !mediaUrl) {
    return (
      <Link href="/ads" className="flex flex-col gap-2">
        <div
          className="text-nowrap h-10 px-5 gap-2 w-full flex rounded-[50px] items-center justify-center text-sm font-semibold text-white"
          style={{
            backgroundImage: `radial-gradient(circle at 0% 0%, ${ACCENT_START}, transparent 55%), radial-gradient(circle at 100% 100%, ${ACCENT_END}, transparent 55%), linear-gradient(135deg, #020617, #0f172a)`,
          }}
        >
          {labelText}
          <ArrowUpRightFromSquare size={20} />
        </div>
      </Link>
    );
  }

  // Real image ad
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="flex flex-col gap-2"
    >
      <div className="w-70 rounded-2xl overflow-hidden border border-white/10 bg-black/80">
        {/* Banner image */}
        <div className="relative w-full h-10 bg-black">
          <Image
            src={mediaUrl}
            alt={ad.owner_username ?? "Sponsored ad"}
            fill
            sizes="100vw"
            className="object-cover"
          />
          
        </div>


        {/* Text + CTA row */}
        
      </div>
    </Link>
  );
}