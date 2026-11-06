"use client";

/**
 * Retired multi-placement interface.
 *
 * All legacy route, menu, grid, footer and playback ads are disabled.
 * The only active advertisement is the single SitewideAd mounted in app/layout.tsx.
 * These compatibility exports do not create <ins> elements or load scripts.
 */
export function AdSlot() { return null; }
export function SponsoredAdPanel() { return null; }
export function DesktopAdRail() { return null; }
export function DesktopReelsAds() { return null; }
export function MobileHeaderAd() { return null; }
export function MobileMenuAds() { return null; }
export function ReelsPauseAd() { return null; }
export function ExploreGridAd() { return null; }
export function MobileBannerAd() { return null; }
export function AdContactFooter() { return null; }
