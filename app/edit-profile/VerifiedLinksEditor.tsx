"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Info, X, AlertCircle, BadgeCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PROVIDERS, type ProviderKey, type LinkState } from "@/app/components/verify/providers";
import { updateProfileLinks } from "@/lib/actions/settingsLinks";
import { VerifiedBadgeIcon } from "../components/icons/VerifiedBadgeIcon";

const PINK_BTN = "bg-pink-500 hover:bg-pink-600 text-black font-semibold rounded-full";

function pickActiveProviders(links: Partial<LinkState>): ProviderKey[] {
  return (Object.keys(links) as ProviderKey[]).filter((k) => (links[k] ?? "").trim().length > 0);
}

export default function VerifiedLinksEditor(props: {
  verified: boolean;
  initialLinks?: Partial<LinkState> | null;
}) {
  const { verified, initialLinks } = props;

  const [links, setLinks] = useState<LinkState>(() => {
    const base: any = {};
    for (const p of PROVIDERS) base[p.key] = "";
    if (initialLinks) {
      for (const [k, v] of Object.entries(initialLinks)) base[k] = String(v ?? "");
    }
    return base as LinkState;
  });

  const [activeProviders, setActiveProviders] = useState<ProviderKey[]>(
    () => pickActiveProviders(initialLinks ?? {})
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleProvider = (key: ProviderKey) => {
    setSuccess(null);
    setError(null);
    setActiveProviders((prev) => {
      if (prev.includes(key)) {
        setLinks((old) => ({ ...old, [key]: "" }));
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleLinkChange = (key: ProviderKey, value: string) => {
    setSuccess(null);
    setError(null);
    setLinks((prev) => ({ ...prev, [key]: value }));
  };

  const clearLink = (key: ProviderKey) => {
    setSuccess(null);
    setError(null);
    setLinks((prev) => ({ ...prev, [key]: "" }));
  };

  const cleanedPayload = useMemo(() => {
    // send all keys, server will sanitize + drop empties
    const out: Record<string, string> = {};
    for (const p of PROVIDERS) out[p.key] = (links[p.key] ?? "").trim();
    return out;
  }, [links]);

  if (!verified) {
    return (
      <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Lock className="h-4 w-4 text-white/70" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Creator links</h2>
            <p className="text-sm text-white/70">
              Only <span className="font-semibold">verified</span> creators can add external links.
            </p>
            <Link href="/verify" className="text-pink-500 underline text-sm">
              Go verify your account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-[#121212] border border-white/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)]">
        {/* Left copy */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-white/40 flex items-center justify-center text-sm">
              <VerifiedBadgeIcon />
            </div>
            <h2 className="text-base sm:text-lg font-semibold">Creator links</h2>
          </div>

          <p className="mt-3 text-sm text-white/80">
            Click a logo to add a link field. Add as many platforms as you want.
          </p>
          <p className="mt-3 text-xs text-white/60">
            These links appear on your profile. Keep them clean and matching your branding.
          </p>
        </div>

        {/* Right side – icons + active link fields */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Links
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/50">
              <Info className="h-3.5 w-3.5" />
              Click a logo to add your link
            </div>
          </div>

          {/* Logos row */}
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => {
              const active = activeProviders.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleProvider(p.key)}
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold border transition 
                    ${
                      active
                        ? "bg-pink-500 border-pink-400 text-black"
                        : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                    }`}
                  aria-pressed={active}
                >
                  {p.short}
                </button>
              );
            })}
          </div>

          {/* Active link fields */}
          {activeProviders.length > 0 ? (
            <div className="space-y-2.5 max-h-[20rem] overflow-y-auto pr-1">
              {activeProviders.map((key) => {
                const provider = PROVIDERS.find((p) => p.key === key)!;
                const value = links[key] || "";
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5"
                  >
                    <div className="shrink-0 h-8 w-8 rounded-full bg-pink-500 text-black flex items-center justify-center text-[10px] font-semibold">
                      {provider.short}
                    </div>

                    <div className="flex-1 min-w-0">
                      <label htmlFor={`link-${key}`} className="block text-xs text-white/70 mb-1">
                        {provider.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`link-${key}`}
                          value={value}
                          onChange={(e) => handleLinkChange(key, e.target.value)}
                          placeholder={provider.placeholder}
                          className="h-9 text-xs bg-black/40 border-white/20"
                        />
                        {value.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearLink(key)}
                            className="p-1 rounded-full hover:bg-white/10 text-white/70"
                            aria-label={`Clear ${provider.label} link`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/45">
              No links selected yet. Click any logo above to add your first link.
            </p>
          )}

          {/* Save */}
          <div className="pt-2 flex flex-col items-stretch sm:items-end gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setSuccess(null);

                startTransition(async () => {
                  try {
                    await updateProfileLinks(cleanedPayload);
                    setSuccess("Links saved!");
                  } catch (e: any) {
                    setError(e?.message ?? "Failed to save links.");
                  }
                });
              }}
              className={`${PINK_BTN} w-full sm:w-56 h-10 inline-flex items-center justify-center gap-2`}
            >
              {pending && (
                <span className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
              )}
              Save links
            </Button>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-300 max-w-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-[2px]" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 text-xs text-emerald-300 max-w-xs">
                <BadgeCheck className="h-3.5 w-3.5 mt-[2px]" />
                <span>{success}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
