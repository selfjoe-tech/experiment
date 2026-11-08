"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "goongram:age-18-confirmed:v1";
type GateState = "checking" | "required" | "allowed";

/**
 * First-visit adult self-attestation (not identity-based age verification).
 * Keep the established storage key, navigation behavior and inert page content.
 */
export default function AdultAgeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    try {
      setState(localStorage.getItem(STORAGE_KEY) === "yes" ? "allowed" : "required");
    } catch {
      setState("required");
    }
  }, []);

  useEffect(() => {
    if (state === "allowed") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [state]);

  const confirmAdult = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "yes");
    } catch {
      // Allow this browser session when storage is unavailable.
    }
    setState("allowed");
  };

  const leaveSite = () => {
    try {
      const referrer = new URL(document.referrer);
      if (
        (referrer.protocol === "https:" || referrer.protocol === "http:") &&
        referrer.origin !== window.location.origin
      ) {
        window.location.replace(referrer.href);
        return;
      }
    } catch {
      // Visitors may land directly without a referrer.
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.replace("https://www.google.com/");
  };

  // Underlying pages remain server-rendered for SEO but are inert until
  // 18+ confirmation. The overlay is higher than media, ads and dialogs.
  return (
    <>
      <div
        inert={state !== "allowed"}
        aria-hidden={state !== "allowed"}
        data-age-confirmed={state === "allowed" ? "true" : "false"}
      >
        {children}
      </div>

      {state !== "allowed" && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-[#08080b] px-4 py-5 text-white sm:px-6 sm:py-8">
          {state === "checking" ? (
            <div className="fixed inset-0 grid place-items-center bg-[#08080b]" aria-label="Checking age confirmation">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#ec4899]" />
            </div>
          ) : (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_12%,rgba(236,72,153,.11),transparent_38%),radial-gradient(ellipse_at_83%_90%,rgba(139,92,246,.10),transparent_38%)]"
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="adult-gate-title"
                aria-describedby="adult-gate-description"
                className="relative mx-auto max-h-[calc(100dvh-40px)] w-full max-w-[440px] overflow-y-auto rounded-[26px] border border-white/[.13] bg-[#121217] px-6 pb-7 pt-8 text-center shadow-[0_32px_110px_rgba(0,0,0,.72)] sm:px-10 sm:pb-9 sm:pt-10"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-pink-500/80 to-transparent"
                />

                <div className="flex justify-center">
                  <Image
                    unoptimized
                    src="/icons/goon.png"
                    alt="Goon Gram"
                    width={230}
                    height={96}
                    priority
                    className="h-auto max-h-[78px] w-[210px] object-contain sm:w-[230px]"
                  />
                </div>

                <div className="mx-auto mt-8 flex h-[88px] w-[88px] items-center justify-center rounded-[26px] bg-gradient-to-tr from-[#f97316] via-[#ec4899] to-[#8b5cf6] p-[2px] shadow-[0_10px_50px_rgba(236,72,153,.13)]">
                  <div className="flex h-full w-full items-center justify-center rounded-[24px] bg-[#181820] text-[29px] font-bold tracking-[-0.06em]">
                    18+
                  </div>
                </div>

                <h1
                  id="adult-gate-title"
                  className="mt-6 text-[26px] font-semibold tracking-[-0.045em] sm:text-[30px]"
                >
                  Are you 18 or older?
                </h1>

                <p
                  id="adult-gate-description"
                  className="mx-auto mt-3 max-w-[315px] text-[13px] leading-[1.8] text-white/55 sm:text-[14px]"
                >
                  Goon Gram contains sexually explicit content intended only for adults.
                  Confirm your age to continue.
                </p>

                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    autoFocus
                    onClick={confirmAdult}
                    className="flex min-h-[49px] w-full items-center justify-center rounded-xl bg-[#ec4899] px-5 text-[14px] font-semibold text-white transition hover:bg-[#f472b6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Yes, I am 18 or older
                  </button>

                  <button
                    type="button"
                    onClick={leaveSite}
                    className="flex min-h-[49px] w-full items-center justify-center rounded-xl border border-white/20 bg-white/[.035] px-5 text-[14px] font-semibold text-white/85 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    No, I am under 18
                  </button>
                </div>

                <div className="mt-7 border-t border-white/[.09] pt-5">
                  <p className="mx-auto max-w-[300px] text-[11px] leading-[1.8] text-white/35">
                    By entering, you confirm that you meet the minimum age requirement.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
