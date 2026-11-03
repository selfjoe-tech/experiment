// components/icons/VerifiedBadgeIcon.tsx
import { BadgeCheck } from "lucide-react";
import * as React from "react";
import Image from "next/image";



export function LongLogo(
  ) {
  return (
    <div className="flex items-center ">
  {/* First image - hidden on smaller screens */}
  

  {/* Second image - always visible */}
  {/* <Image
    src="/icons/logo7.png"
    width={50}
    height={50}
    alt="Gram"
    className="object-contain"
  /> */}

  <Image
    src="/icons/goon.png"
    width={150}
    height={100}
    alt="Goon"
    className="hidden sm:block object-contain"
  />
</div>

  );
}
