// app/embed/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Video } from "@/app/components/feed/types";
import { fetchVideoForEmbed } from "@/lib/actions/mediaFeed";
import EmbedVideoCard from "@/app/components/embed/EmbedVideoCard";
import { Button } from "@/components/ui/button";


export default function EmbedVideoPage() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const mediaId = Number(idParam);

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!mediaId || Number.isNaN(mediaId)) {
      setError("Invalid video id.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const v = await fetchVideoForEmbed(mediaId);
        if (!v) {
          setError("Video not found.");
        } else {
          setVideo(v);
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load video.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mediaId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-sm">
        Loading…
      </div>
    );
  }

  

  if (error || !video) {
    return (
      <div className="min-h-screen flex flex-col gap-2 items-center justify-center bg-black text-white text-sm">
        {error || "Video not found."}
        <Button 

        onClick={() => {
          router.push("/")
        }}
        
        >
          Visit Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <EmbedVideoCard
        video={video}
        isMuted={isMuted}
        toggleMute={() => setIsMuted((m) => !m)}
      />
    </div>
  );
}
