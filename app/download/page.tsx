import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import WatchBottomAds from "@/app/components/ads/WatchBottomAds";
import UrlDownloaderClient from "./UrlDownloaderClient";

export const metadata: Metadata = {
  title: "Video Downloader for X, Instagram, Pornhub & Redgifs",
  description: "Download public videos you have permission to save using links from X (Twitter), Instagram, Pornhub and Redgifs.",
  alternates: { canonical: "https://goongram.com/download" },
};

export default function DownloadPage() {
  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] text-white">
      <DesktopShell />
      <MobileChrome />

      <main className="mx-auto w-full max-w-[1540px] px-4 pb-[120px] pt-[125px] sm:px-6 lg:pl-[104px] lg:pr-8 lg:pt-14 min-[1360px]:pl-[125px]">
        <div className="mx-auto w-full max-w-[1190px]">
          <header className="max-w-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[.06]">
              <ArrowDownToLine size={23} />
            </div>
            <h1 className="text-[35px] font-semibold leading-[1.08] tracking-[-.045em] sm:text-[48px]">
              Download videos with a link.
            </h1>
            <p className="mt-4 max-w-[580px] text-[14px] leading-7 text-white/55 sm:text-[15px]">
              Save publicly available videos from X, Instagram, Pornhub and Redgifs.
              Paste a video link, select its quality and download.
            </p>
          </header>

          <div className="mt-9 grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_328px] lg:gap-7">
            <section className="min-w-0">
              <UrlDownloaderClient />
            </section>

            <aside aria-label="Sponsored ad placements" className="min-w-0 border-t border-white/10 pt-5 lg:border-t-0 lg:pt-0">
              <h2 className="mb-3 text-[13px] font-medium text-white/55">Sponsored</h2>
              <StaticPageAdPair />
            </aside>
          </div>

          <div className="mt-12">
            {/* The page-level floating zone 1130842 is mounted once by RootLayout.
                This footer adds 1130841 and 1107996 once; the rail above adds
                1130835, 1130836, 1130843 and 1130846 once. */}
            <WatchBottomAds />
          </div>
        </div>
      </main>
    </div>
  );
}
