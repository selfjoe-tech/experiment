// app/page.tsx (or wherever HomePage lives)
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import VideoFeed from "@/app/components/feed/VideoFeed";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import type { FeedTab } from "@/app/components/feed/types";
import { supabase } from "@/lib/supabaseClient";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";

export default function ReelsPage() {
  // default selected: Trending
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Simple auth check using Supabase
  useEffect(() => {

    (async () => {
      const LoggedInState = await getIsLoggedInFromCookies();
      setIsLoggedIn(LoggedInState)
      setAuthLoaded(true);
    })();

    
  }, []);

  const [mobileNavHidden, setMobileNavHidden] = useState(false);


  const showForYouGate =
    activeTab === "forYou" && authLoaded && !isLoggedIn;

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Desktop: left nav + top nav + ads column */}
      <DesktopShell navHidden={desktopNavHidden} />

      {/* Mobile: top bar + bottom navbar */}
      <MobileChrome
        activeTab={activeTab}
        onTabChange={setActiveTab}
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


      {/* For you / Trending switch – fixed over the video area */}
      <div className="pointer-events-none fixed top-[74px] lg:top-5 lg:pr-0 left-1/2 lg:left-[calc(50%-132px)] min-[1360px]:left-[calc(50%-48px)] z-30 -translate-x-1/2">
        <div className="inline-flex gap-8 text-sm font-medium text-white pointer-events-auto">
          {(["forYou", "trending"] as FeedTab[]).map((tabKey) => {
            const label = tabKey === "forYou" ? "For You" : "Trending";
            const active = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`pb-1 transition-colors ${
                  active ? "text-white" : "text-white/70 hover:text-white"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`block mt-1 rounded-full ${
                    active ? "h-[1px] bg-white" : "h-[3px] bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Advertisements remain outside the Reel video scroller. */}
      <aside aria-label="Reels advertisements"
        className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 h-[138px] overflow-hidden border-t border-white/10 bg-[#0b0d10] px-2 pt-1 lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-[180px] lg:z-10 lg:h-auto lg:w-[340px] lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-1 lg:pt-0">
        <StaticPageAdPair compactOnMobile />
      </aside>

      {/* Main area: either the For You gate or the real VideoFeed */}
      {showForYouGate ? (
        <ForYouLoginGate />
      ) : authLoaded ? (
        <VideoFeed
          withAds
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onScrollDirectionChange={(direction) => {
                const hide = direction === "down";
            setDesktopNavHidden(hide);
            setMobileNavHidden(hide);} // ✅ mobile follows same rule

          }
          
        />
      ) : (
        // tiny fallback while auth status loads
        <div className="flex h-screen items-center justify-center lg:pl-[76px] lg:pr-0 min-[1360px]:pl-[244px]">
          <div className="h-[80vh] w-full max-w-[430px] animate-pulse rounded-lg bg-white/[.05]" aria-label="Loading Reels" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* For You login gate                                                 */
/* ------------------------------------------------------------------ */

function ForYouLoginGate() {
  return (
    <main className="relative h-screen lg:pl-[76px] min-[1360px]:pl-[244px] lg:pr-0">
      <div className="relative h-full flex items-center justify-center">
        {/* Background image behind the card */}

        {/* Card */}
        <div className="flex flex-col items-center justify-center relative max-w-sm w-full h-full bg-black/80 border border-white/15 shadow-2xl overflow-hidden"
          style={{
    // 👈 change this path to match your file in /public
          backgroundImage: "url('/images/unlock.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        
        >
          {/* subtle divider line like the screenshot */}
          <div className="px-6 pt-8 pb-6 text-center">
            <p className="text-sm text-white mb-6">
              You must be logged in to view the{" "}
              <span className="font-semibold">&ldquo;For You&rdquo;</span> feed.
            </p>

            <a href="/auth/login">
              <button
                type="button"
                className="w-full rounded-full bg-[pink] text-black font-semibold py-3 text-sm hover:brightness-95 transition"
              >
                Log In
              </button>
            </a>
          </div>

          <div className="h-px bg-white/10" />

          <div className="px-6 py-5 text-center space-y-3">
            <p className="text-xs text-white/70 mb-1">
              Don&apos;t have an account?
            </p>
            <a href="/auth/signup">
              <button
                type="button"
                className="w-full rounded-full border border-white text-sm font-semibold py-3 hover:bg-white/5 transition"
              >
                Sign Up
              </button>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}





// "use client";

// import React, { useState } from "react";
// import DesktopShell from "@/app/components/feed/layout/DesktopShell";
// import MobileChrome from "@/app/components/feed/layout/MobileChrome";
// import VideoFeed from "@/app/components/feed/VideoFeed";
// import type { FeedTab } from "@/app/components/feed/types";

// export default function HomePage() {
//   // default selected: Trending
//   const [activeTab, setActiveTab] = useState<FeedTab>("trending");
//   const [isMobileSearching, setIsMobileSearching] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [desktopNavHidden, setDesktopNavHidden] = useState(false);

//   return (
//     <div className="relative min-h-screen bg-black text-white overflow-hidden">
//       {/* Desktop: left nav + top nav + ads column */}
//       <DesktopShell navHidden={desktopNavHidden} />

//       {/* Mobile: top bar + bottom navbar */}
//       <MobileChrome
//         activeTab={activeTab}
//         onTabChange={setActiveTab}
//         isSearching={isMobileSearching}
//         onSearchOpen={() => setIsMobileSearching(true)}
//         onSearchClose={() => {
//           setIsMobileSearching(false);
//           setSearchQuery("");
//         }}
//         searchQuery={searchQuery}
//         setSearchQuery={setSearchQuery}
//       />

//       {/* For you / Trending switch – fixed over the video area */}
//       <div className="pointer-events-none fixed top-14 lg:top-5 lg:pr-20 left-1/2 z-30 -translate-x-1/2">
//         <div className="inline-flex gap-8 text-sm font-medium text-white pointer-events-auto">
//           {(["forYou", "trending"] as FeedTab[]).map((tabKey) => {
//             const label = tabKey === "forYou" ? "For you" : "Trending";
//             const active = activeTab === tabKey;
//             return (
//               <button
//                 key={tabKey}
//                 type="button"
//                 onClick={() => setActiveTab(tabKey)}
//                 className={`pb-1 transition-colors ${
//                   active ? "text-white" : "text-white/70 hover:text-white"
//                 }`}
//               >
//                 <span>{label}</span>
//                 <span
//                   className={`block mt-1 rounded-full ${
//                     active ? "h-[3px] bg-white" : "h-[3px] bg-transparent"
//                   }`}
//                 />
//               </button>
//             );
//           })}
//         </div>
//       </div>

      

//       {/* Main feed (desktop + mobile) */}
//       <VideoFeed
//         activeTab={activeTab}
//         onTabChange={setActiveTab}
//         onScrollDirectionChange={(direction) =>
//           setDesktopNavHidden(direction === "down")
//         }
//       />
//     </div>
//   );
// }
