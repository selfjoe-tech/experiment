"use client";

import { X } from "lucide-react";

type AdDismissButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

/**
 * High-contrast 44x44 close target, placed in the publisher wrapper
 * rather than inside the ad network's own <ins> markup.
 */
export default function AdDismissButton({
  onClick,
  label = "Close advertisement",
  className = "",
}: AdDismissButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pointer-events-auto relative z-30 inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-[#0b0d10] shadow-[0_3px_14px_rgba(0,0,0,0.65)] transition-colors hover:bg-[#e9e9e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d10] active:bg-[#dcdcdc] ${className}`}
    >
      <X className="h-6 w-6" size={24} strokeWidth={2.75} aria-hidden="true" />
    </button>
  );
}
