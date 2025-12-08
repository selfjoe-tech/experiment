// app/[username]/manage/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Ellipsis, Search, X, Trash2 } from "lucide-react";

import { useInView } from "@/app/components/media/useInView";
import LazyVideo from "@/app/components/media/LazyVideo";
import {
  MANAGE_PAGE_SIZE,
  MediaTab,
  ManagedMedia,
  fetchManagedMedia,
  searchManagedMedia,
  updateManagedMedia,
  deleteManagedMedia,
} from "@/lib/actions/manageUploads";

type TabKey = MediaTab; // "all" | "gifs" | "images"

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ManageUploadsPage() {
  const params = useParams<{ username: string }>();
  const username = (params?.username ?? "").toString();

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [items, setItems] = useState<ManagedMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");


  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  const { ref: sentinelRef, inView: sentinelInView } =
    useInView<HTMLDivElement>({ threshold: 0.2 });

  const isSearchMode = debouncedSearch.trim().length > 0;

    // Initial / tab change load, but only when NOT searching
  


   useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400); // 400ms debounce

    return () => window.clearTimeout(handle);
  }, [searchTerm]);

    const loadMore = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const pageToLoad = opts?.reset ? 0 : pageRef.current;

        const data = await fetchManagedMedia({
          username,
          tab: activeTab,
          page: pageToLoad,
          pageSize: MANAGE_PAGE_SIZE,
        });

        if (opts?.reset) {
          setItems(data);
        } else {
          setItems((prev) => [...prev, ...data]);
        }

        if (!data || data.length < MANAGE_PAGE_SIZE) {
          setHasMore(false);
        } else {
          pageRef.current = pageToLoad + 1;
        }
      } catch (err: any) {
        console.error("manage loadMore error", err);
        setError(err?.message ?? "Failed to load uploads");
        setHasMore(false);
      } finally {
        setLoading(false);
        setInitialLoaded(true);
        loadingRef.current = false;
      }
    },
    [username, activeTab]
  );


  useEffect(() => {
    if (isSearchMode) return; // search effect handles this case

    pageRef.current = 0;
    setItems([]);
    setHasMore(true);
    setInitialLoaded(false);
    loadMore({ reset: true });
  }, [username, activeTab, isSearchMode, loadMore]);


    // Search mode: whenever debouncedSearch changes, fetch from DB
  useEffect(() => {
    const q = debouncedSearch.trim();

    if (!q) {
      // cleared search → go back to normal, first page
      pageRef.current = 0;
      setItems([]);
      setHasMore(true);
      setInitialLoaded(false);
      loadMore({ reset: true });
      return;
    }

    // search mode
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchManagedMedia({
          username,
          tab: activeTab,
          query: q,
        });
        setItems(data);
        setHasMore(false); // no infinite scroll for search (for now)
        setInitialLoaded(true);
      } catch (err: any) {
        console.error("manage search error", err);
        setError(err?.message ?? "Failed to search uploads");
        setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedSearch, username, activeTab, loadMore]);


  // initial / reset load when tab or username changes
  useEffect(() => {
    pageRef.current = 0;
    setItems([]);
    setHasMore(true);
    setInitialLoaded(false);
    loadMore({ reset: true });
  }, [username, activeTab, loadMore]);

  // infinite scroll – disabled while searching
  useEffect(() => {
    if (!initialLoaded) return;
    if (!sentinelInView) return;
    if (!hasMore) return;
    if (searchTerm.trim().length > 0) return;
    loadMore();
  }, [initialLoaded, sentinelInView, hasMore, loadMore, searchTerm]);

  const [selected, setSelected] = useState<ManagedMedia | null>(null);
  const [player, setPlayer] = useState<ManagedMedia | null>(null);

  // Apply tab filter ("all", "gifs", "images") + searchTerm on top
  const visibleItems = useMemo(() => {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const desc = (item.description ?? "").toLowerCase();

    // tags is a text[] column: ["gaming", "fever"]
    const tagsRaw = item.tags ?? [];
    const tagsString = Array.isArray(tagsRaw)
      ? tagsRaw.join(" ").toLowerCase()
      : String(tagsRaw).toLowerCase();

    const inDesc = desc.includes(q);
    const inTags = tagsString.includes(q);

    return inDesc || inTags;
  });
}, [items, searchTerm]);

  return (
    <main className="px-3 sm:px-4 pt-6 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">
          Manage Your Uploads
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-white/10 mb-4">
        {(["all", "gifs", "images"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm capitalize ${
              activeTab === tab
                ? "font-semibold text-white border-b-2 border-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab === "all" ? "All" : tab === "gifs" ? "GIFs" : "Images"}
          </button>
        ))}
      </div>

      {/* Search bar with magnifying glass */}
      <div className="mb-4">
        <div className="w-full flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/70">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black text-lg">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your content by description or tags"
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/50"
          />
        </div>
      </div>

      {/* Error / loading states */}
      {error && (
        <div className="mb-3 text-sm text-red-400">{error}</div>
      )}

      {!initialLoaded && loading && (
        <div className="py-10 text-center text-white/70">
          Loading your uploads…
        </div>
      )}

      {initialLoaded &&
  items.length === 0 &&
  !loading &&
  !error && (
    <div className="py-10 text-center text-white/70">
      No uploads match your filters.
    </div>
)}

      {/* Media cards */}
      <div className="space-y-4">
  {items.map((item) => (
    <ManageMediaCard
      key={item.id}
      item={item}
      onOpenModal={() => setSelected(item)}
      onOpenPlayer={() =>
        item.mediaType === "image" ? null : setPlayer(item)
      }
    />
  ))}
</div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loading && initialLoaded && (
        <div className="py-4 text-center text-xs text-white/60">
          Loading more…
        </div>
      )}

      {/* Edit/Delete modal */}
      {selected && (
        <EditMediaModal
          media={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setItems((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
            setSelected(null);
          }}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((m) => m.id !== id));
            setSelected(null);
          }}
        />
      )}

      {/* Playback overlay for videos */}
      {player && (
        <VideoOverlay
          media={player}
          onClose={() => setPlayer(null)}
        />
      )}
    </main>
  );
}

/* ==================== Card UI ==================== */


function EditMediaModal({
  media,
  onClose,
  onUpdated,
  onDeleted,
}: {
  media: ManagedMedia;
  onClose: () => void;
  onUpdated: (m: ManagedMedia) => void;
  onDeleted: (id: number) => void;
}) {
  const [description, setDescription] = useState(media.description ?? "");
  const [tagsInput, setTagsInput] = useState(media.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tags =
        tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean) ?? [];

      const updated = await updateManagedMedia({
        id: media.id,
        description: description || null,
        tags,
      });

      if (!updated) {
        setError("Failed to save changes");
        return;
      }

      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this media and all related info?")) return;
    setDeleting(true);
    setError(null);
    const res = await deleteManagedMedia({
      id: media.id,
      storagePath: media.storagePath,
    });

    if (!res.ok) {
      setError(res.error ?? "Failed to delete media");
      setDeleting(false);
      return;
    }

    onDeleted(media.id);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-[130] w-[92vw] max-w-md rounded-2xl border border-white/15 bg-black/95 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Edit media</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 text-xs text-white/70">
          ID: <span className="font-mono">{media.id}</span>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-white/70 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm outline-none focus:border-white/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm outline-none focus:border-white/40"
              placeholder="Amateur, Ass, Big Tits"
            />
          </div>
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-400">{error}</div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/60 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageMediaCard({
  item,
  onOpenModal,
  onOpenPlayer,
}: {
  item: ManagedMedia;
  onOpenModal: () => void;
  onOpenPlayer: () => void | null;
}) {
  const tags = item.tags ?? [];
  const isImage = item.mediaType === "image";

  return (
    <section className="rounded-3xl border border-white/10 bg-black/70 p-3 flex gap-3">
      {/* media thumb + checkbox */}
      <div
        className="relative w-32 h-32 rounded-2xl overflow-hidden bg-neutral-900 flex-shrink-0 cursor-pointer"
        onClick={() => {
          if (!isImage) onOpenPlayer();
        }}
      >
        {isImage ? (
          <Image
            src={item.url}
            alt="upload thumbnail"
            fill
            className="object-cover"
            sizes="128px"
          />
        ) : (
          <LazyVideo src={item.url} className="w-full h-full" hoverPlay />
        )}
        <div className="absolute top-2 left-2 h-5 w-5 rounded-md border border-white/80 bg-black/40" />
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 text-xs">
            <div className="text-white flex gap-2">
              <span>Likes</span>
              <span className="font-semibold">
                {item.likeCount.toLocaleString()}
              </span>
            </div>
            <div className="text-white flex gap-2">
              <span>Views</span>
              <span className="font-semibold">
                {item.viewCount.toLocaleString()}
              </span>
            </div>
            <div className="text-white flex gap-2">
              <span>Date</span>
              <span className="font-semibold">
                {formatDate(item.createdAt)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenModal}
            className="shrink-0 h-9 w-9 rounded-full border border-white/40 flex items-center justify-center text-white hover:bg-white/10"
          >
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[11px] border border-lime-400 text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ==================== Video overlay ==================== */

function VideoOverlay({
  media,
  onClose,
}: {
  media: ManagedMedia;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />
      <div className="relative z-[150] w-full h-full flex items-center justify-center p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[160] rounded-full p-2 bg-black/60 hover:bg-black/80 text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <video
          src={media.url}
          controls
          autoPlay
          playsInline
          className="max-h-full max-w-full rounded-2xl bg-black"
        />
      </div>
    </div>
  );
}
