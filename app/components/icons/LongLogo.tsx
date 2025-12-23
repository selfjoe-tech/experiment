// components/icons/VerifiedBadgeIcon.tsx
import { BadgeCheck } from "lucide-react";
import * as React from "react";
import Image from "next/image";



export function LongLogo(
  ) {
  return (
    <div className="flex flex-col justify-center">

    <div className="flex gap-1 items-center text-2xl font-bold tracking-wide">
        <span className="text-white">Upskirt</span>
        <div className="flex items-center justify-center rounded-[10px] text-pink-500">
          Candy
          <Image
            src={"/icons/logo7.png"}
            height={50}
            width={50}
            alt="Upskirt Candy heart shaped logo with a halo on top of it"
          
          />
        </div>
      </div> 
    </div>

  );
}
