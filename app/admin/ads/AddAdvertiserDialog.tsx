"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addAdBuyer } from "./actions"; // adjust path if needed

export function AddAdvertiserDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [slot, setSlot] = useState(1);
  const [exists, setExists] = useState<null | boolean>(null);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // debounced username check
  useEffect(() => {
    const trimmed = username.trim();

    if (!trimmed) {
      setExists(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    setExists(null);

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/check-username?username=${encodeURIComponent(trimmed)}`
        );

        if (!res.ok) {
          console.error("check-username failed", await res.text());
          setExists(false);
          return;
        }

        const json = await res.json();
        setExists(Boolean(json.exists));
      } catch (e) {
        console.error(e);
        setExists(false);
      } finally {
        setChecking(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [username]);

  const canAdd = !!username.trim() && exists === true && !adding;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canAdd) return;

    setAdding(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await addAdBuyer(formData);

      // assume success if it didn't throw; your action logs errors
      setOpen(false);
      setUsername("");
      setSlot(1);
      setExists(null);
    } catch (err) {
      console.error("Add advertiser failed", err);
      setErrorMessage("Something went wrong while adding the advertiser.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 rounded-full bg-pink-500 text-xs font-semibold text-black"
      >
        Add advertiser
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-4 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Add advertiser</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <input type="hidden" name="slot" value={slot} />

              <div className="space-y-2">
                <label className="block text-xs text-white/70">Username</label>
                <input
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
                  placeholder="@username"
                />

                {checking && (
                  <div className="text-[11px] text-white/50">
                    Checking username...
                  </div>
                )}
                {exists === true && !checking && (
                  <div className="text-[11px] text-emerald-300">
                    User found
                  </div>
                )}
                {exists === false && !checking && (
                  <div className="text-[11px] text-red-300">
                    User does not exist
                  </div>
                )}

                <label className="block text-xs text-white/70 mt-3">
                  Slot ID
                </label>
                <input
                  type="number"
                  min={1}
                  name="slot"
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value) || 1)}
                  className="w-full h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
                />
              </div>

              {errorMessage && (
                <div className="mt-2 text-[11px] text-red-400">
                  {errorMessage}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-3 rounded-full bg-white/10 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canAdd}
                  className={`h-9 px-4 rounded-full text-xs font-semibold ${
                    canAdd
                      ? "bg-pink-500 text-black"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {adding ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
