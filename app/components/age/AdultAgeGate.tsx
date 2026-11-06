"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "goongram:age-18-confirmed:v1";
type GateState = "checking" | "required" | "allowed";

/**
 * First-visit adult self-attestation, not identity-based age verification.
 * Site content and ad components stay unmounted until the user confirms 18+.
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
    return () => { document.body.style.overflow = previous; };
  }, [state]);

  const confirmAdult = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "yes");
    } catch {
      // Allow this visit even when browser storage is blocked.
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
      // Direct visitors may not have a referrer.
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.replace("https://www.google.com/");
  };

  // Keep public page HTML server-rendered for crawlers while retaining the
  // same interactive, full-screen age confirmation for every visitor.
  // Unconfirmed visitors cannot focus or interact with the underlying page.
  return (
    <>
      <div inert={state !== "allowed"} aria-hidden={state !== "allowed"}
        data-age-confirmed={state === "allowed" ? "true" : "false"}>
        {children}
      </div>
      {state !== "allowed" && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-[#07070a] px-4 py-8 text-white">
          {state === "checking" ? (
            <div className="fixed inset-0 bg-[#09090b]" aria-label="Checking age confirmation" />
          ) : (
            <div role="dialog" aria-modal="true" aria-labelledby="adult-gate-title"
              aria-describedby="adult-gate-description"
              className="w-full max-w-[440px] rounded-2xl border border-white/15 bg-[#15151a] px-6 py-9 text-center shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:px-10">
              <div className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-pink-400">18+ Adults only</div>
              <h1 id="adult-gate-title" className="text-3xl font-bold tracking-tight">Are you 18 or older?</h1>
              <p id="adult-gate-description" className="mt-4 text-sm leading-6 text-white/65">
                Goon Gram contains sexually explicit material intended only for adults aged 18 or older.
                Please confirm your age to enter.
              </p>
              <div className="mt-8 grid gap-3">
                <button autoFocus type="button" onClick={confirmAdult}
                  className="w-full rounded-xl bg-pink-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-pink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Yes, I am 18+
                </button>
                <button type="button" onClick={leaveSite}
                  className="w-full rounded-xl border border-white/20 bg-white/[.04] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  No, I am Under 18
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
