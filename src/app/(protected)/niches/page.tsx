"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import VideoCard from "@/components/ui/VideoCard";
import {
  addKeyword,
  createNiche,
  deleteKeyword,
  deleteNiche,
  getNiches,
  Niche,
  scanNicheYouTube,
  updateNicheStatus,
} from "@/lib/services/niche";
import {
  getVideosByNiche,
  VideoDays,
  VideoSort,
} from "@/lib/services/scaned-trends";
import { TrendVideo } from "@/types/types";

const SORT_OPTIONS: VideoSort[] = ["score", "views", "recent"];
const DAY_OPTIONS: VideoDays[] = [7, 30];

function parseSelectedNiche(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSort(value: string | null): VideoSort {
  return SORT_OPTIONS.includes(value as VideoSort)
    ? (value as VideoSort)
    : "score";
}

function parseDays(value: string | null): VideoDays | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return DAY_OPTIONS.includes(parsed as VideoDays)
    ? (parsed as VideoDays)
    : null;
}

function parseMinViews(value: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
}

function VideoCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-24 w-40 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/3 rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-full bg-gray-200" />
            <div className="h-8 w-20 rounded-full bg-gray-200" />
          </div>
          <div className="h-4 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export default function NichesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeywords, setNewKeywords] = useState<{ [nicheId: number]: string }>(
    {}
  );
  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [newNiche, setNewNiche] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Niche | null>(null);
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(
    parseSelectedNiche(searchParams.get("niche"))
  );
  const [expandedNiches, setExpandedNiches] = useState<{ [id: number]: boolean }>(
    {}
  );
  const [leftWidth, setLeftWidth] = useState(320);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [scanningNiche, setScanningNiche] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanMessageType, setScanMessageType] = useState<"success" | "error" | null>(
    null
  );
  const [sort, setSort] = useState<VideoSort>(parseSort(searchParams.get("sort")));
  const [minViews, setMinViews] = useState(parseMinViews(searchParams.get("min_views")));
  const [days, setDays] = useState<VideoDays | "">(
    parseDays(searchParams.get("days")) ?? ""
  );

  const videoFilters = useMemo(
    () => ({
      sort,
      min_views: minViews ? Number(minViews) : undefined,
      days: days === "" ? null : days,
    }),
    [days, minViews, sort]
  );

  function updateQueryParams(nextValues: {
    niche?: number | null;
    sort?: VideoSort;
    min_views?: string;
    days?: VideoDays | "";
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValues.niche !== undefined) {
      if (nextValues.niche === null) {
        params.delete("niche");
      } else {
        params.set("niche", String(nextValues.niche));
      }
    }

    if (nextValues.sort !== undefined) {
      params.set("sort", nextValues.sort);
    }

    if (nextValues.min_views !== undefined) {
      if (nextValues.min_views) {
        params.set("min_views", nextValues.min_views);
      } else {
        params.delete("min_views");
      }
    }

    if (nextValues.days !== undefined) {
      if (nextValues.days === "") {
        params.delete("days");
      } else {
        params.set("days", String(nextValues.days));
      }
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await getNiches();
        setNiches(data);
      } catch (err) {
        console.error("Failed to load niches", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setSelectedNicheId(parseSelectedNiche(searchParams.get("niche")));
    setSort(parseSort(searchParams.get("sort")));
    setMinViews(parseMinViews(searchParams.get("min_views")));
    setDays(parseDays(searchParams.get("days")) ?? "");
  }, [searchParams]);

  const handleMouseDown = () => {
    isResizing.current = true;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) {
      return;
    }

    setLeftWidth(Math.max(250, Math.min(600, e.clientX)));
  };

  const handleMouseUp = () => {
    isResizing.current = false;
  };

  useEffect(() => {
    if (!selectedNicheId) {
      setVideos([]);
      return;
    }

    const nicheId = selectedNicheId;
    async function loadVideos() {
      try {
        setLoadingVideos(true);
        const data = await getVideosByNiche(nicheId, videoFilters);
        setVideos(data);
      } catch (err) {
        console.error("Failed to load videos", err);
      } finally {
        setLoadingVideos(false);
      }
    }

    loadVideos();
  }, [selectedNicheId, videoFilters]);

  useEffect(() => {
    setScanMessage(null);
    setScanMessageType(null);
  }, [selectedNicheId]);

  useEffect(() => {
    if (!containerRef.current || niches.length === 0) {
      return;
    }

    const elements = containerRef.current.querySelectorAll(".niche-name");
    let maxWidth = 200;

    elements.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > maxWidth) {
        maxWidth = rect.width;
      }
    });

    setLeftWidth(Math.min(maxWidth + 80, 450));
  }, [niches]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedNiches((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  async function handleDeleteKeyword(nicheId: number, keywordId: number) {
    try {
      await deleteKeyword(nicheId, keywordId);

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: n.keywords.filter((k) => k.id !== keywordId),
              }
            : n
        )
      );
    } catch (err) {
      console.error("Failed to delete keyword", err);
    }
  }

  async function handleAddKeyword(nicheId: number) {
    const raw = newKeywords[nicheId]?.trim();
    if (!raw) {
      return;
    }

    const keywords = raw
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    try {
      const createdKeywords = await Promise.all(
        keywords.map((keyword) => addKeyword(nicheId, keyword))
      );

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: [...n.keywords, ...createdKeywords],
              }
            : n
        )
      );

      setNewKeywords((prev) => ({ ...prev, [nicheId]: "" }));
      inputRefs.current[nicheId]?.focus();
    } catch (err) {
      console.error("Failed to add keyword", err);
    }
  }

  async function handleToggleNiche(nicheId: number, active: boolean) {
    try {
      await updateNicheStatus(nicheId, active);

      setNiches((prev) =>
        prev.map((n) => (n.id === nicheId ? { ...n, is_active: active } : n))
      );
    } catch (err) {
      console.error("Failed to update niche status", err);
    }
  }

  async function handleCreateNiche() {
    if (!newNiche.trim()) {
      return;
    }

    try {
      const created = await createNiche(newNiche);
      setNiches((prev) => [...prev, created]);
      setNewNiche("");
    } catch (err) {
      console.error("Failed to create niche", err);
    }
  }

  async function handleDeleteNicheConfirmed() {
    if (!deleteTarget) {
      return;
    }

    try {
      const deletedNicheId = deleteTarget.id;
      await deleteNiche(deletedNicheId);

      setNiches((prev) => prev.filter((n) => n.id !== deletedNicheId));

      if (selectedNicheId === deletedNicheId) {
        setSelectedNicheId(null);
        setVideos([]);
        updateQueryParams({ niche: null });
      }

      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete niche", err);
    }
  }

  async function handleManualScan() {
    if (!selectedNicheId) {
      return;
    }

    const selectedNiche = niches.find((niche) => niche.id === selectedNicheId);
    const selectedNicheName = selectedNiche?.display_name ?? "selected niche";

    try {
      setScanningNiche(true);
      setScanMessage(`Scanning YouTube for ${selectedNicheName}...`);
      setScanMessageType(null);

      const response = await scanNicheYouTube(selectedNicheId);
      //const result = response
      console.log("Scan result:", response);
      

      setScanMessage(
        `Scan result ${response.videos_saved} videos saved.`
      );
      setScanMessageType("success");
      setLoadingVideos(true);

      try {
        const refreshedVideos = await getVideosByNiche(selectedNicheId, videoFilters);
        setVideos(refreshedVideos);
      } catch (refreshErr) {
        console.error("Failed to refresh videos after scan", refreshErr);
      } finally {
        setLoadingVideos(false);
      }
    } catch (err) {
      console.error("Failed to scan niche YouTube videos", err);
      setScanMessage(
        err instanceof Error ? err.message : "Failed to scan niche YouTube videos"
      );
      setScanMessageType("error");
    } finally {
      setScanningNiche(false);
    }
  }

  if (loading) {
    return <div>Loading niches...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <div
        ref={containerRef}
        style={{ width: leftWidth }}
        className="overflow-y-auto border-r pr-2"
      >
        <h1 className="mb-4 text-xl font-semibold">Niches</h1>

        <div className="mb-4 flex gap-1">
          <Button onClick={handleCreateNiche}>
            <span className="flex items-center justify-center text-lg font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-plus-icon lucide-plus"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </span>
          </Button>
          <input
            type="text"
            placeholder="New niche name"
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            className="w-full rounded border border-green-500 px-2 py-0.5 text-sm"
          />
        </div>

        <div className="space-y-3">
          {niches.map((niche) => (
            <div
              key={niche.id}
              className={`rounded-lg p-1 transition ${
                selectedNicheId === niche.id
                  ? "border-green-400 bg-green-50"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex cursor-pointer items-center gap-2"
                  onClick={() => {
                    setSelectedNicheId(niche.id);
                    updateQueryParams({ niche: niche.id });
                    toggleExpand(niche.id);
                  }}
                >
                  <span className="text-xs">
                    {expandedNiches[niche.id] ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-down-icon lucide-chevron-down"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-right-icon lucide-chevron-right"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    )}
                  </span>

                  <span className="niche-name inline-block font-medium">
                    {niche.display_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleNiche(niche.id, !niche.is_active);
                    }}
                    className={`flex h-4 w-8 items-center rounded-full p-0.5 ${
                      niche.is_active ? "bg-green-800" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full bg-white transition ${
                        niche.is_active ? "translate-x-4" : ""
                      }`}
                    />
                  </button>

                  <Button
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(niche);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-trash2-icon lucide-trash-2"
                    >
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </div>

              {expandedNiches[niche.id] && (
                <div className="mt-3 space-y-2 pl-5">
                  <div className="flex flex-col gap-2">
                    {niche.keywords.map((keyword) => (
                      <span
                        key={keyword.id}
                        className="flex items-center justify-between rounded bg-gray-200 px-2 py-0.5 text-xs"
                      >
                        {keyword.keyword}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKeyword(niche.id, keyword.id);
                          }}
                          className="text-gray-500 hover:text-red-700"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-x-icon lucide-x"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>

                  <input
                    ref={(el) => {
                      inputRefs.current[niche.id] = el;
                    }}
                    type="text"
                    placeholder="Add keyword (comma separated)"
                    value={newKeywords[niche.id] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setNewKeywords((prev) => ({
                        ...prev,
                        [niche.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword(niche.id);
                      }
                    }}
                    className="w-full rounded border px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize bg-gray-300 hover:bg-gray-400"
      />

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedNicheId && (
          <div className="text-gray-500">Select a niche to view videos</div>
        )}

        {selectedNicheId && (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <select
                  value={sort}
                  onChange={(e) => {
                    const nextSort = e.target.value as VideoSort;
                    setSort(nextSort);
                    updateQueryParams({ sort: nextSort });
                  }}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="score">Score</option>
                  <option value="views">Views</option>
                  <option value="recent">Recent</option>
                </select>

                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Min views"
                  value={minViews}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setMinViews(nextValue);
                    updateQueryParams({ min_views: nextValue });
                  }}
                  className="w-32 rounded border px-2 py-1 text-sm"
                />

                <select
                  value={days}
                  onChange={(e) => {
                    const nextDays = e.target.value
                      ? (Number(e.target.value) as VideoDays)
                      : "";
                    setDays(nextDays);
                    updateQueryParams({ days: nextDays });
                  }}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="">All time</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </div>

              <div className="flex max-w-md justify-end gap-3">

                {scanMessage && (
                  <span
                    className={`text-right text-sm ${
                      scanMessageType === "error"
                        ? "text-red-600"
                        : scanMessageType === "success"
                          ? "text-green-700"
                          : "text-gray-600"
                    }`}
                  >
                    {scanMessage}
                  </span>
                )}

                <button
                  onClick={handleManualScan}
                  disabled={scanningNiche}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scanningNiche ? "Scanning" : "Scan Now"}
                </button>


              </div>
            </div>

            {loadingVideos ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <VideoCardSkeleton key={index} />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-gray-500">No videos found</div>
            ) : (
              <div className="flex flex-col gap-4">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          open={true}
          title="Delete Niche"
          message={`Are you sure you want to delete "${deleteTarget.display_name}"?`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteNicheConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
