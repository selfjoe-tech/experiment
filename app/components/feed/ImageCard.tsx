// app/components/explore/ImageCard.tsx
"use client";

import Link from "next/link";
import {
  Eye,
  Heart,
  MessageCircle,
  EllipsisIcon,
  Loader2,
  SendHorizonal,
  ChevronLeftIcon,
  ArrowUpRightFromSquare
} from "lucide-react";

import {
  checkHasLikedMedia,
  toggleMediaLike,
  checkIsFollowing,
  toggleFollowUser,
} from "@/lib/actions/social";

import { getUserIdFromCookies } from "@/lib/actions/auth";

import {
  fetchImageById,
  ImageMedia,
  registerView,
} from "@/lib/actions/mediaFeed";

import {
  fetchCommentsForMedia,
  addCommentForMedia,
  toggleCommentLikeForMedia,
  type CommentNode,
} from "@/lib/actions/comments";

import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CommentListSkeleton } from "../skeletons/CommentListSkeleton";

type Props = {
  mediaId?: number;               // 🔸 now optional (ads won't have media row)
  initialSrc?: string;
  initialViews?: number;
  fullscreen?: boolean;

  // NEW for ads
  variant?: "default" | "sponsored";
  visitUrl?: string;
  sponsorName?: string | null;
  onClose?: () => void;
};

export type ImageExploreItem = {
  id: string;
  src: string;
  alt?: string;
  views?: number;

  // NEW: optional ad metadata
  _isAd?: boolean;
  _adId?: number;
  _adLandingUrl?: string | null;
  _adOwnerUsername?: string | null;
};



export default function ImageCard({
  mediaId,
  initialSrc,
  initialViews,
  fullscreen = false,
  onClose
}: Props) {
  const [data, setData] = useState<ImageMedia | null>(null);
  const [loading, setLoading] = useState(true);

  const [views, setViews] = useState<number>(initialViews ?? 0);
  const [likes, setLikes] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [likeBurstVisible, setLikeBurstVisible] = useState(false);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const hasRegisteredViewRef = useRef(false);

  // FOLLOW STATE
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // COMMENTS STATE
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const [optionsOpen, setOptionsOpen] = useState(false); // for ellipsis menu

  const clickTimeoutRef = useRef<number | null>(null); // double-click like

  const totalComments = countComments(comments);

  // ===== heart burst animation =====
  const triggerLikeBurst = () => {
    if (likeBurstTimeoutRef.current !== null) {
      window.clearTimeout(likeBurstTimeoutRef.current);
    }
    setLikeBurstVisible(true);
    likeBurstTimeoutRef.current = window.setTimeout(() => {
      setLikeBurstVisible(false);
      likeBurstTimeoutRef.current = null;
    }, 550);
  };

  useEffect(() => {
    return () => {
      if (likeBurstTimeoutRef.current !== null) {
        window.clearTimeout(likeBurstTimeoutRef.current);
      }
    };
  }, []);

  // ===== fetch image metadata =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchImageById(mediaId);
        if (!res || cancelled) return;

        setData(res);
        setViews(initialViews ?? res.views ?? 0);
        setLikes(res.likes ?? 0);

        if (res.likedByMe !== undefined) {
          setLiked(!!res.likedByMe);
        } else {
          const hasLiked = await checkHasLikedMedia(mediaId);
          if (!cancelled) setLiked(hasLiked);
        }
      } catch (err) {
        console.error("ImageCard fetchImageById error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId, initialViews]);

  // ===== register a view once per open =====
  useEffect(() => {
    if (!mediaId || Number.isNaN(mediaId)) return;
    if (hasRegisteredViewRef.current) return;

    hasRegisteredViewRef.current = true;
    setViews((prev) => (prev ?? 0) + 1);

    registerView(mediaId).catch((err) =>
      console.error("registerView(image) error", err)
    );
  }, [mediaId]);

  // ===== LIKE toggle (optimistic) =====
  const handleToggleLike = async () => {
    if (!mediaId || Number.isNaN(mediaId)) return;

    const nextLiked = !liked;
    setLikeLoading(true);
    setLiked(nextLiked);
    setLikes((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    if (nextLiked) triggerLikeBurst();

    try {
      const result = await toggleMediaLike(mediaId);
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
      }
      if (result.likeCount != null) {
        setLikes(result.likeCount);
      }
    } catch (err) {
      console.error("toggleMediaLike(image) error", err);
      // revert
      setLiked(!nextLiked);
      setLikes((prev) =>
        !nextLiked ? prev + 1 : Math.max(0, prev - 1)
      );
    } finally {
      setLikeLoading(false);
    }
  };

  // current user id
  useEffect(() => {
    (async () => {
      const id = await getUserIdFromCookies();
      setCurrentId(id);
    })();
  }, []);

  // FOLLOW: initial state
  useEffect(() => {
    let cancelled = false;
    if (!data?.ownerId) return; // adjust if your field is named differently

    (async () => {
      try {
        setFollowLoading(true);
        const following = await checkIsFollowing(data.ownerId);
        if (!cancelled) setIsFollowing(following);
      } catch (err) {
        console.error("checkIsFollowing(image) error", err);
      } finally {
        if (!cancelled) setFollowLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data?.ownerId]);

  const handleFollowClick = async () => {
    if (!data?.ownerId) return;

    setFollowLoading(true);
    try {
      const res = await toggleFollowUser(data.ownerId);
      setIsFollowing(res.following);
    } catch (err) {
      console.error("toggleFollowUser(image) error", err);
    } finally {
      setFollowLoading(false);
    }
  };

  // Load comments when overlay opens
  useEffect(() => {
    if (!commentsOpen || !mediaId) return;

    setCommentsLoading(true);
    setCommentsError(null);

    (async () => {
      try {
        const data = await fetchCommentsForMedia(mediaId);
        setComments(data);
      } catch (err: any) {
        console.error("fetchCommentsForMedia(image) error", err);
        setCommentsError("Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [commentsOpen, mediaId]);

  // Desktop vs mobile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaId || !newComment.trim()) return;

    try {
      const updated = await addCommentForMedia({
        mediaId,
        text: newComment,
        parentId: replyTo?.id ?? null,
      });
      setComments(updated);
      setNewComment("");
      setReplyTo(null);
    } catch (err: any) {
      console.error("addCommentForMedia(image) error", err);
      setCommentsError(err?.message ?? "Failed to post comment.");
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!mediaId) return;

    try {
      const updated = await toggleCommentLikeForMedia(mediaId, commentId);
      setComments(updated);
    } catch (err: any) {
      console.error("toggleCommentLikeForMedia(image) error", err);
      setCommentsError("Failed to like comment.");
    }
  };

  // double-click anywhere on the card to like
  const handleOverlayClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleToggleLike(); // double click → like
      return;
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      // single click does nothing for now
    }, 250);
  };

  const src = data?.src ?? initialSrc ?? "";
  const username = data?.username ?? "Unknown";
  const avatar = data?.avatar ?? "/avatar-placeholder.png";
  const description = data?.description ?? "";
  const hashtags = data?.hashtags ?? [];

  const showSkeleton = !imgLoaded;

  return (
    <div
      className="
        relative h-[100vh]
        w-full
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      "
    >
      <div
        className={
           "relative w-full h-[100vh] flex items-center justify-center"
        }
      >
        {showSkeleton && (
          <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
        )}

        {src && (
          <Image
            src={src}
            alt={description || username}
            width={1600} // just defines aspect ratio
            height={1600}
            sizes={
              
                "(max-width:768px) 50vw, 33vw"
            }
            className={`
              h-full max-h-full w-auto object-contain
              transition-opacity duration-300
              ${imgLoaded ? "opacity-100" : "opacity-0"}
            `}
            onLoadingComplete={() => {
              setImgLoaded(true);
            }}
          />
        )}
      </div>

      {/* double-click overlay for liking */}
      <button
        type="button"
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 focus:outline-none"
      >
        <span className="sr-only">Like image</span>
      </button>

      {/* ❤️ LIKE BURST OVERLAY */}
      {likeBurstVisible && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 like-burst drop-shadow-[0_0_18px_rgba(248,113,113,1)]" />
        </div>
      )}

      <div className="absolute flex left-3 top-12 z-30 flex-col items-center">
              
                <button
                  onClick={() => {
                    onClose();
                    
                  }}
                >
                  <ChevronLeftIcon size={30}/>
                </button>
              
              
            </div>

      {/* right-side actions */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
        <StatBubble label={views.toLocaleString()}>
          <Eye className="h-7 w-7" />
        </StatBubble>

        {/* LIKE */}
        <div className="flex flex-col items-center gap-1">
          <IconCircleButton
            onClick={handleToggleLike}
            label="Like"
            disabled={likeLoading}
          >
            <Heart
              className={`h-7 w-7 ${
                liked ? "fill-red-500 text-red-500" : ""
              }`}
            />
          </IconCircleButton>
          <span className="text-[11px]">
            {likes.toLocaleString()}
          </span>
        </div>

        {/* COMMENTS */}
        <div className="flex flex-col items-center gap-1">
          <IconCircleButton
            onClick={() => setCommentsOpen(true)}
            label="Comments"
          >
            <MessageCircle className="h-7 w-7" />
          </IconCircleButton>
          <span className="text-[11px]">
            {totalComments.toLocaleString()}
          </span>
        </div>

        {/* MORE OPTIONS */}
        <IconCircleButton
          onClick={() => setOptionsOpen(true)}
          label="More options"
        >
          <EllipsisIcon className="h-7 w-7" />
        </IconCircleButton>
      </div>

      {/* bottom info */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
        {/* creator row */}
        <div className="flex items-center gap-3">
          <Link href={`/${username}`}>
            <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
              <Image
                src={avatar}
                alt={username}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          </Link>

          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/${username}`}>
              <div className="text-sm font-semibold truncate">
                {username}
              </div>
            </Link>

            {data?.ownerId && data.ownerId !== currentId && (
              <button
                type="button"
                onClick={handleFollowClick}
                disabled={followLoading}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  isFollowing
                    ? "bg-white text-black border-transparent"
                    : "border-white/60 bg-black/50 text-white"
                }`}
              >
                {followLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                  "Following"
                ) : (
                  "Follow"
                )}
              </button>
            )}
          </div>
        </div>

        {/* description + tags */}
        <div className="text-xs text-white/85">
          <p
            className={`overflow-hidden transition-all ${
              expandedDesc ? "max-h-24" : "max-h-5"
            }`}
          >
            {description}{" "}
            {hashtags.map((tag) => (
              <span key={tag} className="text-white/70">
                #{tag}{" "}
              </span>
            ))}
          </p>
          {description || hashtags.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpandedDesc((p) => !p)}
              className="mt-0.5 text-[11px] text-white/70"
            >
              Show {expandedDesc ? "less" : "more"}
            </button>
          ) : null}
        </div>
      </div>

      {/* gradients */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

      <VideoOptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        mediaId={mediaId}
      />

      {/* Comments overlay: dialog on desktop, drawer on mobile */}
      <CommentsOverlay
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        isDesktop={isDesktop}
        comments={comments}
        loading={commentsLoading}
        error={commentsError}
        newComment={newComment}
        setNewComment={setNewComment}
        onSubmit={handleSubmitComment}
        onLikeComment={handleToggleCommentLike}
        onReplyStart={(c) => setReplyTo({ id: c.id, username: c.username })}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
    </div>
  );
}

type IconCircleButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

function IconCircleButton({
  children,
  onClick,
  label,
  className,
  disabled,
}: IconCircleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80 disabled:opacity-50 ${
        className || ""
      }`}
    >
      {children}
    </button>
  );
}

function StatBubble({
  label,
  children,
}: {
  label: string | number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
        {children}
      </div>
      <span className="mt-1 text-[11px]">
        {typeof label === "number" ? label.toLocaleString() : label}
      </span>
    </div>
  );
}

function countComments(nodes: CommentNode[]): number {
  return nodes.reduce(
    (sum, c) => sum + 1 + countComments(c.replies ?? []),
    0
  );
}

type CommentsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  comments: CommentNode[];
  loading: boolean;
  error: string | null;
  newComment: string;
  setNewComment: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onLikeComment: (id: string) => void;
  onReplyStart: (c: CommentNode) => void;
  replyTo: { id: string; username: string } | null;
  setReplyTo: (v: { id: string; username: string } | null) => void;
};

function CommentsOverlay({
  open,
  onOpenChange,
  isDesktop,
  comments,
  loading,
  error,
  newComment,
  setNewComment,
  onSubmit,
  onLikeComment,
  onReplyStart,
  replyTo,
  setReplyTo,
}: CommentsOverlayProps) {
  const content = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <CommentListSkeleton />}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-white/60">No comments yet.</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <CommentList
          comments={comments}
          onLike={onLikeComment}
          onReply={onReplyStart}
        />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-white/10 px-4 py-3 space-y-2 bg-black"
      >
        {replyTo && (
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Replying to @{replyTo.username}</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="bg-black border-white/30 text-white placeholder:text-white/40 h-10 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 px-4 rounded-full bg-white text-black text-xs font-semibold hover:bg:white/90"
          >
            <SendHorizonal />
          </Button>
        </div>
      </form>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-full bg-black text-white border-white/10 z-[100]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Comments
            </DialogTitle>
          </DialogHeader>
          <div className="h-96">{content}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // mobile drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-black text-white border-t border-white/10 z-[100]">
        <DrawerHeader>
          <DrawerTitle className="text-sm font-semibold">
            Comments
          </DrawerTitle>
        </DrawerHeader>
        <div className="h-[60vh]">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}

function CommentList({
  comments,
  onLike,
  onReply,
  level = 0,
}: {
  comments: CommentNode[];
  onLike: (id: string) => void;
  onReply: (c: CommentNode) => void;
  level?: number;
}) {
  if (!comments || comments.length === 0) return null;

  return (
    <div
      className={
        level > 0
          ? "pl-4 border-l border-white/10 space-y-2"
          : "space-y-2"
      }
    >
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 text-xs">
          <div className="mt-1 h-7 w-7 rounded-full bg-white/10 overflow-hidden shrink-0">
            {c.avatar_path ? (
              <Link href={`/${c.username}`}>
                <Image
                  src={c.avatar_path}
                  alt={c.username}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </Link>
            ) : null}
          </div>
          <div className="flex-1">
            <Link href={`/${c.username}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{c.username}</span>
              </div>
            </Link>

            <p className="mt-0.5 text-white/80">{c.comment}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
              <button
                type="button"
                onClick={() => onLike(c.id)}
                className="inline-flex items:center gap-1 hover:text:white"
              >
                <Heart
                  className={`h-3 w-3 ${
                    c.liked_by && c.liked_by.length > 0
                      ? "fill-red-500 text-red-500"
                      : ""
                  }`}
                />
                <span>{(c.likes ?? 0).toLocaleString()}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(c)}
                className="hover:text-white"
              >
                Reply
              </button>
            </div>

            {c.replies && c.replies.length > 0 && (
              <CommentList
                comments={c.replies}
                onLike={onLike}
                onReply={onReply}
                level={level + 1}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
