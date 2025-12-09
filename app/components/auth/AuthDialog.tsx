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
import { LongLogo } from "../icons/LongLogo";

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
          className="z-[60] border-white/15 bg-black text-white p-0
                     sm:max-w-[560px] max-h-[700px] rounded-2xl shadow-2xl overflow-y-auto"
        >
          

          <DialogHeader className="mt-10">
            <DialogTitle className="mx-auto">
            <LongLogo />
            </DialogTitle>
          </DialogHeader>

          <div className="px-8 pb-8">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
