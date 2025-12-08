"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {BackgroundGradientAnimation} from "@/components/ui/background-gradient-animation";
import Image from "next/image";

export default function AuthDialog({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/home";

  const onClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace(redirect);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        {/* Background gradient under the overlay */}
        <BackgroundGradientAnimation />

        {/* Make overlay translucent so gradient is visible */}

        <DialogContent
          className="z-[60] p-0 overflow-hidden border-white/15 bg-black text-white
                     sm:max-w-[560px] rounded-2xl shadow-2xl overflow-y-auto"
        >
          

          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="mx-auto text-2xl font-bold tracking-wide">
            <div className="text-2xl font-bold tracking-wide mb-8">
              <span className="text-pink-500">Upskirt</span>Candy
            </div>
            </DialogTitle>
          </DialogHeader>

          <div className="px-8 pb-8">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
