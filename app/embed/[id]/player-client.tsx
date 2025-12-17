"use client";

import { useState } from "react";
import type { Video } from "@/app/components/feed/types";
import EmbedVideoCard from "@/app/components/embed/EmbedVideoCard";

export default function EmbedPlayerClient({ initialVideo }: { initialVideo: Video }) {
  const [isMuted, setIsMuted] = useState(true);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <EmbedVideoCard
        video={initialVideo}
        isMuted={isMuted}
        toggleMute={() => setIsMuted((m) => !m)}
      />
    </div>
  );
}
