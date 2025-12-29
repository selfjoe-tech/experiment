"use client";

import { buildPublicUrl } from "@/lib/actions/mediaFeed";
import { supabase } from "@/lib/supabaseClient";
import { ArrowUpRightFromSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fetchRandomMobileBannerAd, type SidebarAd } from "@/lib/actions/ads";
import Script from "next/script";


const ACCENT_START = "#a855f7";
const ACCENT_END = "#ec4899";

declare global {
  interface Window {
    adsbyjuicy?: any[];
  }
}

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



export function MobileAd() {
  return (
    <div className="flex flex-col max-w-200 ">
      {/* JuicyAds v3.0: loads the engine that fetches/renders ads */}
      <Script
        id="juicyads-jads"
        src="https://poweredby.jads.co/js/jads.js"
        strategy="afterInteractive"
        data-cfasync="false"
        async
      />

      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/80">
        {/* Ad slot */}
        <div className="relative w-60 h-10 bg-black flex items-center justify-center">
          <ins id="1107996" data-width="300" data-height="50"></ins>
        </div>

        {/* JuicyAds init: queues the ad request (jads.js will pick it up) */}
        <Script
          id="juicyads-init-1107996"
          strategy="afterInteractive"
          data-cfasync="false"
          dangerouslySetInnerHTML={{
            __html: `(adsbyjuicy = window.adsbyjuicy || []).push({'adzone':1107996});`,
          }}
        />

        {/* Optional footer / CTA */}
        
      </div>
    </div>
  );
}