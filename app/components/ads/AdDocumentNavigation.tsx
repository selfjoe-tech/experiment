"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * JuicyAds uses a page-level script and adzone IDs. Its documented v3 snippets
 * do not expose a supported reset API for Next.js client navigation.
 *
 * Navigating to ad-bearing pages with a fresh browser document preserves the
 * original vendor script and avoids stale ad-zone state without monkeypatching
 * adsbyjuicy or injecting duplicate copies of jads.js.
 *
 * This intentionally trades SPA navigation for reliable ad initialization.
 */
function pageContainsPublisherAds(pathname: string): boolean {
  const withoutAds = /^\/(?:api|_next|admin|auth|embed|earn|edit-profile|verify|upload|watermark|watermark-lab|preferences)(?:\/|$)/;
  return !withoutAds.test(pathname);
}

export default function AdDocumentNavigation() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Make ordinary internal links to ad-bearing pages perform a real navigation
    // before Next.js Link intercepts them and reuses the existing document.
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || link.dataset.clientNavigation === "true" ||
          (link.target && link.target !== "_self")) return;

      let next: URL;
      try { next = new URL(link.href, window.location.href); }
      catch { return; }

      if (next.protocol !== "https:" && next.protocol !== "http:") return;
      if (next.origin !== window.location.origin) return;

      const samePage = next.pathname === window.location.pathname &&
        next.search === window.location.search;
      if (samePage || !pageContainsPublisherAds(next.pathname)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(next.href);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    // Covers router.push, history traversal, and other non-anchor navigations
    // that bypass the click handler. The new document resets the pathname ref,
    // so no refresh loop occurs.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (pageContainsPublisherAds(pathname)) window.location.reload();
  }, [pathname]);

  return null;
}
