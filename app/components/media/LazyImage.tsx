"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useInView } from "./useInView";
import { Skeleton } from "@/components/ui/skeleton";

export default function LazyImage({
  src,
  alt,
  className,
  sizes = "(max-width: 1024px) 33vw, 25vw",
  fill = true,          // good for grid tiles
  width,
  height,
  priority = false,
  rounded = true,
}: {
  src: string;
  alt?: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  rounded?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);

  return (
    <div ref={ref} className={`relative ${className} ${rounded ? "overflow-hidden rounded-md" : ""}`}>
      {!inView ? (
        <Skeleton className="absolute inset-0 h-full w-full" />
      ) : (
        <Image
          src={src}
          alt={alt || ""}
          sizes={sizes}
          {...(fill ? { fill: true } : { width: width || 400, height: height || 400 })}
          priority={priority}
          onLoadingComplete={() => setLoaded(true)}
          className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
