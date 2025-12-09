// app/page.tsx (or wherever HomePage lives)
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import VideoFeed from "@/app/components/feed/VideoFeed";
import type { FeedTab } from "@/app/components/feed/types";
import { supabase } from "@/lib/supabaseClient";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";

export default function HomePage() {
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

    
  }, [isLoggedIn]);

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
      />

      {/* For you / Trending switch – fixed over the video area */}
      <div className="pointer-events-none fixed top-14 lg:top-5 lg:pr-20 left-1/2 z-30 -translate-x-1/2">
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

      {/* Main area: either the For You gate or the real VideoFeed */}
      {showForYouGate ? (
        <ForYouLoginGate />
      ) : authLoaded ? (
        <VideoFeed
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onScrollDirectionChange={(direction) =>
            setDesktopNavHidden(direction === "down")
          }
        />
      ) : (
        // tiny fallback while auth status loads
        <div className="flex h-screen items-center justify-center lg:pl-[17rem] lg:pr-[21rem]">
          <span className="text-sm text-white/60">Loading…</span>
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
    <main className="relative h-screen lg:pl-[17rem] lg:pr-[21rem] lg:pt-16">
      <div className="relative h-full flex items-center justify-center px-3 sm:px-4">
        {/* Background image behind the card */}

        {/* Card */}
        <div className="flex flex-col items-center justify-center relative max-w-sm w-full h-full bg-black/80 border border-white/15 shadow-2xl overflow-hidden"
          style={{
    // 👈 change this path to match your file in /public
          backgroundImage: "url('/images/for-you-locked-bg.jpg')",
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

            <Link href="/auth/login">
              <button
                type="button"
                className="w-full rounded-full bg-[pink] text-black font-semibold py-3 text-sm hover:brightness-95 transition"
              >
                Log In
              </button>
            </Link>
          </div>

          <div className="h-px bg-white/10" />

          <div className="px-6 py-5 text-center space-y-3">
            <p className="text-xs text-white/70 mb-1">
              Don&apos;t have an account?
            </p>
            <Link href="/auth/signup">
              <button
                type="button"
                className="w-full rounded-full border border-white text-sm font-semibold py-3 hover:bg-white/5 transition"
              >
                Sign Up
              </button>
            </Link>
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
