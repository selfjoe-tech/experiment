// app/components/explore/ExploreGridSkeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ExploreGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton
            key={i}
            className="h-full w-full" 
        />

      ))}
    </div>
  );
}
