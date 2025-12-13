// app/components/feed/types.ts

export type FeedTab = "trending" | "following" | "new" | "forYou";

export type Video = {
  id: string;
  mediaId: number;
  src: string;
  title: string;
  description: string;
  username: string;
  avatar: string;
  likes: number;
  views: number;
  hashtags: string[];
  ownerId?: string;
  likedByMe?: boolean;
  verified?: boolean;

  // NEW: used only for ads
  _isAd?: boolean;
  _adLandingUrl?: string | null;
  _adId?: number;
};
