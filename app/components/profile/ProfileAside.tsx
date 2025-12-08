"use client";

import { X } from "lucide-react";
import ProfileMenuContent from "./ProfileMenuContent";
import clsx from "clsx";

/**
 * Fixed panel that appears to the right of the left sidebar.
 * Assumes your left sidebar is w-64 and top nav is h-16,
 * and your right ads column is w-80 (so we don't overlap it).
 */
export default function ProfileAside({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {

    
  return (
    <div
      className={clsx(
        "hidden lg:block fixed z-[40] top-16 bottom-6 left-64", // sit beside sidebar, under top bar
        "pointer-events-none", open
            ? "translate-x-0 opacity-100 pointer-events-auto visible"
            : "-translate-x-4 opacity-0 pointer-events-none invisible"
      )}
      style={{ right: "calc(20rem)" }} // 20rem = w-80 ads column
    >
      <div
        className={clsx(
          "pointer-events-auto w-[420px] h-full rounded-2xl border border-white/10 bg-black/90 backdrop-blur",
          "shadow-2xl",
          "transition-all duration-200 ease-in-out",
          open ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold">Profile</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ProfileMenuContent />
      </div>
    </div>
  );
}
