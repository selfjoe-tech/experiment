"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserPreferencesAction, getUserPreferencesFromCookies } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "straight", label: "Straight" },
  { value: "gay", label: "Gay" },
  { value: "bisexual", label: "Bisexual" },
  { value: "trans", label: "Trans" },
  { value: "lesbian", label: "Lesbian" },
  { value: "animated", label: "Animated" },
] as const;

export default function PreferencePage() {
  const [selected, setSelected] = useState<string[]>(["straight"]);
  const [isPending, startTransition] = useTransition();
  const [initialLoaded, setInitialLoaded] = useState(false);
  const router = useRouter();

  // Pre-fill from cookie if it exists
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const prefs = await getUserPreferencesFromCookies();
        if (!cancelled && prefs && prefs.length) {
          setSelected(prefs);
        }
      } catch {
        // ignore; fall back to default
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleValue = (value: string) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateUserPreferencesAction(selected);
      if (!result.success) {
        // If you want, show an error toast here later
        return;
      }
      router.push("/");
      router.refresh();
    });
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-black/80 px-6 py-7 space-y-5 shadow-2xl"
      >
        <h1 className="text-xl font-semibold">Choose your preferences</h1>
        <p className="text-sm text-white/70">
          Select what type of content you want to see in your feed.
          You can change this later in <span className="font-semibold">Settings</span>.
        </p>

        <div className="space-y-3">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/40 bg-transparent"
                checked={selected.includes(opt.value)}
                onChange={() => toggleValue(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-white/60">
          You must pick at least one preference.
        </p>

        <Button
          type="submit"
          disabled={isPending || selected.length === 0 || !initialLoaded}
          className="w-full h-11 rounded-full bg-white text-black hover:bg-white/90 font-semibold"
        >
          {isPending ? "Saving..." : "Done"}
        </Button>
      </form>
    </main>
  );
}
