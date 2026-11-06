"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import VideoFeed from "@/app/components/feed/VideoFeed";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import type { FeedTab } from "@/app/components/feed/types";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";

export default function ReelsPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getIsLoggedInFromCookies()
      .then(loggedIn => { if (active) setIsLoggedIn(Boolean(loggedIn)); })
      .catch(() => { if (active) setIsLoggedIn(false); })
      .finally(() => { if (active) setAuthLoaded(true); });
    return () => { active = false; };
  }, []);

  function selectTab(tab: FeedTab) {
    setActiveTab(tab);
    // Scrolling a Reel can hide the mobile navigation; show it again on tab changes.
    setMobileNavHidden(false);
    setDesktopNavHidden(false);
  }

  const showForYouGate = authLoaded && !isLoggedIn && activeTab === "forYou";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <DesktopShell navHidden={desktopNavHidden}/>
      <MobileChrome
        activeTab={activeTab}
        onTabChange={selectTab}
        isSearching={isMobileSearching}
        onSearchOpen={() => setIsMobileSearching(true)}
        onSearchClose={() => {
          setIsMobileSearching(false);
          setSearchQuery("");
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        bottomNavHidden={mobileNavHidden}
      />

      {/* Keep tabs fixed above both the Reel feed and the guest sign-in card. */}
      <div className="pointer-events-none fixed left-1/2 top-[74px] z-30 -translate-x-1/2 lg:left-[calc(50%-132px)] lg:top-5">
        <nav aria-label="Reels feeds" className="pointer-events-auto inline-flex gap-8 text-sm font-medium text-white">
          {(["forYou", "trending"] as FeedTab[]).map(tabKey => {
            const active = activeTab === tabKey;
            return (
              <button key={tabKey} type="button"
                onClick={() => selectTab(tabKey)}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 pb-2 transition-colors ${active
                  ? "border-white text-white"
                  : "border-transparent text-white/60 hover:text-white"}`}>
                {tabKey === "forYou" ? "For You" : "Trending"}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Existing publisher ad zones remain mounted independently of the selected tab. */}
      <aside aria-label="Reels advertisements"
        className="fixed isolate inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-[1] h-[138px] overflow-hidden border-t border-white/10 bg-[#0b0d10] px-2 pt-1 lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-[180px] lg:z-[1] lg:h-auto lg:w-[340px] lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-1 lg:pt-0">
        <StaticPageAdPair compactOnMobile/>
      </aside>

      {showForYouGate ? (
        <ForYouLoginGate onBrowseTrending={() => selectTab("trending")}/>
      ) : authLoaded ? (
        <VideoFeed
          withAds
          activeTab={activeTab}
          onTabChange={selectTab}
          onScrollDirectionChange={direction => {
            const hide = direction === "down";
            setDesktopNavHidden(hide);
            setMobileNavHidden(hide);
          }}
        />
      ) : (
        <div className="flex h-screen items-center justify-center lg:pl-[76px]">
          <div className="h-[72vh] w-full max-w-[430px] animate-pulse rounded-lg bg-white/[.04]"
            aria-label="Loading Reels"/>
        </div>
      )}
    </div>
  );
}

function ForYouLoginGate({ onBrowseTrending }: { onBrowseTrending: () => void }) {
  return (
    <main
      aria-label="Sign in to view your For You feed"
      className="relative z-[2] h-[calc(100dvh-199px-env(safe-area-inset-bottom))] lg:h-[100dvh] lg:pl-[76px] lg:pr-[340px]"
    >
      {/* Scrolling is limited to the space below the tabs and above mobile ads. */}
      <div className="h-full overflow-y-auto overscroll-contain px-4 pb-6 pt-[128px] lg:pt-[92px]">
        <section
          className="relative isolate mx-auto flex min-h-[445px] w-full max-w-[390px] flex-col justify-end overflow-hidden rounded-2xl border border-white/[.15] bg-[#111216] text-center shadow-[0_20px_65px_rgba(0,0,0,.32)]"
          style={{
            // Preserve the original Reels guest-gate background image.
            backgroundImage: "url('/images/unlock.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/10 via-black/45 via-45% to-[#0b0d10]" />
          <div className="relative z-10 px-6 pb-8 pt-28 sm:px-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white backdrop-blur-sm">
            <LockKeyhole size={26} strokeWidth={1.5} aria-hidden="true"/>
          </div>

          <h1 className="mt-5 text-[23px] font-semibold tracking-[-0.035em] text-white">
            Your For You feed
          </h1>
          <p className="mx-auto mt-2 max-w-[275px] text-[13px] leading-[1.65] text-white/80">
            Log in to see reels picked for you, follow your favorite creators, and save what you like.
          </p>

          <div className="mt-6 space-y-2.5">
            <a href="/auth/login?redirect=%2Freels"
              className="flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-white/90">
              Log in
            </a>
            <a href="/auth/signup?redirect=%2Freels"
              className="flex min-h-11 w-full items-center justify-center rounded-lg border border-white/25 bg-transparent px-4 text-[13px] font-semibold text-white transition hover:bg-white/[.07]">
              Create account
            </a>
          </div>

          <button type="button" onClick={onBrowseTrending}
            className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/55 transition hover:text-white">
            Continue with Trending
            <ArrowRight size={14} aria-hidden="true"/>
          </button>
          </div>
        </section>
      </div>
    </main>
  );
}
