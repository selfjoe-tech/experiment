// app/components/feed/types.ts

export type FeedTab = "trending" | "following" | "new" | "forYou";

export type Video = {
  id: string;          // stringified media.id
  mediaId: number;     // numeric media.id (for likes/views)
  src: string;

  username: string;
  avatar: string;
  ownerId: string;     // profiles.id (uuid) for follow

  description: string;
  hashtags: string[];

  likes: number;
  views: number;

  likedByMe?: boolean; // optional hint from backend
};

