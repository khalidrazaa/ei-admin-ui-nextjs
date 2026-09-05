"use client";
export const dynamic = "force-dynamic";


import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import Sidebar, { SidebarItem } from "@/components/ui/Sidebar";
import VideoFilters, {
  VideoPaginationControls,
  VideoFilterValues,
} from "@/components/ui/VideoFilters";
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
import { toVideoListParams } from "@/lib/utils/videoFilters";
import { getVideosByNiche } from "@/lib/services/videos";
import { TrendVideo, VideosPagination, VideoTrendStage } from "@/types/types";
const TREND_STAGES: VideoTrendStage[] = [
  "watchlist",
  "emerging",
  "breakout",
  "trending",
  "sustained_demand",
];
const PAGE_SIZE = 20;
const PAGE_SIZES = [10, 20, 50, 100];
const EMPTY_PAGINATION: VideosPagination = {
  page: 1,
  size: PAGE_SIZE,
  total: 0,
  pages: 1,
  has_next: false,
  has_prev: false,
};

function parseSelectedNiche(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMinViews(value: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
}

function parseNonNegativeNumber(value: string | null): string {
  if (value === null || value === "") return "";

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
}

function parseTrendStage(value: string | null): VideoTrendStage | "" {
  return value && TREND_STAGES.includes(value as VideoTrendStage)
    ? (value as VideoTrendStage)
    : "";
}

function parsePage(value: string | null): number {
  if (!value) return 1;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | null): number {
  if (!value) return PAGE_SIZE;

  const parsed = Number(value);
  return PAGE_SIZES.includes(parsed) ? parsed : PAGE_SIZE;
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

function NichesPageContent() {
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
  const [expandedNiches, setExpandedNiches] = useState<{ [id: number]: boolean }>(
    {}
  );
  const [leftWidth, setLeftWidth] = useState(320);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [scanningNiche, setScanningNiche] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanMessageType, setScanMessageType] = useState<"success" | "error" | null>(
    null
  );
  const [keywordMessage, setKeywordMessage] = useState<string | null>(null);
  const [videoPagination, setVideoPagination] = useState<VideosPagination>(EMPTY_PAGINATION);
  const [reloadVersion, setReloadVersion] = useState(0);

  const selectedNicheId = parseSelectedNiche(searchParams.get("niche"));
  const minViews = parseMinViews(searchParams.get("min_views"));
  const publishedFrom = searchParams.get("published_from") ?? "";
  const publishedTo = searchParams.get("published_to") ?? "";
  const trendStage = parseTrendStage(searchParams.get("trend_stage"));
  const regionCode = searchParams.get("region_code") ?? "";
  const source = searchParams.get("source") || "NICHE";
  const categoryTitle = searchParams.get("category_title") ?? "";
  const minScore = parseNonNegativeNumber(searchParams.get("min_score"));
  const minSpeedScore = parseNonNegativeNumber(searchParams.get("min_speed_score"));
  const minBreakoutScore = parseNonNegativeNumber(searchParams.get("min_breakout_score"));
  const minEngagementScore = parseNonNegativeNumber(searchParams.get("min_engagement_score"));
  const minConfidenceScore = parseNonNegativeNumber(searchParams.get("min_confidence_score"));
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("size"));
  const videoFilters = useMemo(
    () => toVideoListParams({
      minViews, publishedFrom, publishedTo, trendStage, regionCode, source,
      categoryTitle, minScore, minSpeedScore, minBreakoutScore,
      minEngagementScore, minConfidenceScore,
    }, page, pageSize),
    [minViews, publishedFrom, publishedTo, trendStage, regionCode, source,
      categoryTitle, minScore, minSpeedScore, minBreakoutScore,
      minEngagementScore, minConfidenceScore, page, pageSize]
  );

  function updateQueryParams(nextValues: {
    niche?: number | null;
    min_views?: string;
    page?: number;
    size?: number;
  } & Partial<VideoFilterValues>) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValues.niche !== undefined) {
      if (nextValues.niche === null) {
        params.delete("niche");
      } else {
        params.set("niche", String(nextValues.niche));
      }
    }

    if (nextValues.min_views !== undefined) {
      if (nextValues.min_views) {
        params.set("min_views", nextValues.min_views);
      } else {
        params.delete("min_views");
      }
    }

    const textFilters = {
      published_from: nextValues.publishedFrom,
      published_to: nextValues.publishedTo,
      trend_stage: nextValues.trendStage,
      region_code: nextValues.regionCode,
      source: nextValues.source,
      category_title: nextValues.categoryTitle,
      min_score: nextValues.minScore,
      min_speed_score: nextValues.minSpeedScore,
      min_breakout_score: nextValues.minBreakoutScore,
      min_engagement_score: nextValues.minEngagementScore,
      min_confidence_score: nextValues.minConfidenceScore,
    };

    Object.entries(textFilters).forEach(([name, value]) => {
      if (value === undefined) return;
      const normalized = value.trim();
      if (normalized) params.set(name, normalized);
      else params.delete(name);
    });

    if (nextValues.page !== undefined) {
      if (nextValues.page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(nextValues.page));
      }
    }

    if (nextValues.size !== undefined) {
      if (nextValues.size === PAGE_SIZE) {
        params.delete("size");
      } else {
        params.set("size", String(nextValues.size));
      }
    }

    const queryString = params.toString();

    router.replace(
      queryString ? `${pathname}?${queryString}` : pathname,
      { scroll: false }
    );
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
      setVideoPagination(EMPTY_PAGINATION);
      setVideoError(null);
      return;
    }
  
    const nicheId = selectedNicheId;
  
    async function loadVideos() {
      try {
        setLoadingVideos(true);
        setVideoError(null);
      
        const response = await getVideosByNiche(nicheId, videoFilters);
      
        setVideos(response.items);
        setVideoPagination(response.pagination);
      } catch (err) {
        console.error("Failed to load videos", err);
        setVideos([]);
        setVideoPagination(EMPTY_PAGINATION);
        setVideoError(err instanceof Error ? err.message : "Unable to load videos for this niche.");
      } finally {
        setLoadingVideos(false);
      }
    }
  
    loadVideos();
  }, [
    selectedNicheId,
    videoFilters,
    reloadVersion,
  ]);

  useEffect(() => {
    setScanMessage(null);
    setScanMessageType(null);
    setKeywordMessage(null);
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

    const existingKeywords = new Set(
      (niches.find((niche) => niche.id === nicheId)?.keywords ?? []).map((entry) =>
        entry.keyword.trim().toLowerCase()
      )
    );

    const keywords = raw
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    const uniqueKeywords = Array.from(new Set(keywords.map((keyword) => keyword.toLowerCase())))
      .map(
        (keyword) =>
          keywords.find((value) => value.toLowerCase() === keyword) as string
      )
      .filter((keyword) => !existingKeywords.has(keyword.toLowerCase()));

    if (uniqueKeywords.length === 0) {
      setKeywordMessage("Those keywords already exist in this niche.");
      return;
    }

    try {
      setKeywordMessage(null);
      const createdKeywords = await Promise.all(
        uniqueKeywords.map((keyword) => addKeyword(nicheId, keyword))
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
      setKeywordMessage(
        err instanceof Error ? err.message : "Failed to add keyword"
      );
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
      setReloadVersion((version) => version + 1);
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

  const sidebarItems: SidebarItem[] = niches.map((niche) => ({
    id: niche.id,
    label: <span className="niche-name inline-block">{niche.display_name}</span>,
    isActive: selectedNicheId === niche.id,
    isExpanded: Boolean(expandedNiches[niche.id]),
    onClick: () => {
      updateQueryParams({ niche: niche.id, page: 1 });
      toggleExpand(niche.id);
    },
    actions: (
      <>
        <button
          type="button"
          aria-label={`${niche.is_active ? "Deactivate" : "Activate"} ${niche.display_name}`}
          aria-pressed={niche.is_active}
          onClick={() => handleToggleNiche(niche.id, !niche.is_active)}
          className={`flex h-4 w-8 items-center rounded-full p-0.5 ${
            niche.is_active ? "bg-green-800" : "bg-gray-300"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-white transition ${
              niche.is_active ? "translate-x-4" : ""
            }`}
          />
        </button>
        <Button variant="danger" onClick={() => setDeleteTarget(niche)}>
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
            aria-hidden="true"
          >
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </Button>
      </>
    ),
    subitems: niche.keywords.map((keyword) => ({
      id: keyword.id,
      label: keyword.keyword,
      actions: (
        <button
          type="button"
          aria-label={`Delete ${keyword.keyword}`}
          onClick={() => handleDeleteKeyword(niche.id, keyword.id)}
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
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ),
    })),
    footer: (
      <input
        ref={(element) => {
          inputRefs.current[niche.id] = element;
        }}
        type="text"
        placeholder="Add keyword (comma separated)"
        value={newKeywords[niche.id] || ""}
        onChange={(event) =>
          setNewKeywords((previous) => ({
            ...previous,
            [niche.id]: event.target.value,
          }))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleAddKeyword(niche.id);
          }
        }}
        className="w-full rounded border px-2 py-1 text-xs"
      />
    ),
  }));

  return (
    <>
      <ProtectedPageShell
        title="Niches"
        description="Manage niche keywords and review scanned video opportunities."
        sidebarClassName="pr-2"
        sidebarStyle={{ width: leftWidth }}
        contentClassName="flex-1 overflow-y-auto px-4"
        sidebarAfter={
          <div
            onMouseDown={handleMouseDown}
            className="w-1 cursor-col-resize bg-gray-300 hover:bg-gray-400"
          />
        }
        sidebar={
          <div ref={containerRef}>
            <Sidebar
              items={sidebarItems}
              header={
                <>
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
                          aria-hidden="true"
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
                      onChange={(event) => setNewNiche(event.target.value)}
                      className="w-full rounded border border-green-500 px-2 py-0.5 text-sm"
                    />
                  </div>

                  {keywordMessage ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {keywordMessage}
                    </div>
                  ) : null}
                </>
              }
              emptyState={<p className="text-sm text-gray-500">No niches yet.</p>}
            />
          </div>
        }
      >
        {!selectedNicheId && (
          <div className="text-gray-500">Select a niche to view videos</div>
        )}

        {selectedNicheId && (
          <>
            <div className="sticky top-0 z-20 -mx-4 mb-1 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
              <VideoFilters
                minViews={minViews}
                publishedFrom={publishedFrom}
                publishedTo={publishedTo}
                trendStage={trendStage}
                regionCode={regionCode}
                source={source}
                categoryTitle={categoryTitle}
                minScore={minScore}
                minSpeedScore={minSpeedScore}
                minBreakoutScore={minBreakoutScore}
                minEngagementScore={minEngagementScore}
                minConfidenceScore={minConfidenceScore}
                lockSource
                onChange={(filters) =>
                  updateQueryParams({
                    min_views: filters.minViews,
                    publishedFrom: filters.publishedFrom,
                    publishedTo: filters.publishedTo,
                    trendStage: filters.trendStage,
                    regionCode: filters.regionCode,
                    source: filters.source,
                    categoryTitle: filters.categoryTitle,
                    minScore: filters.minScore,
                    minSpeedScore: filters.minSpeedScore,
                    minBreakoutScore: filters.minBreakoutScore,
                    minEngagementScore: filters.minEngagementScore,
                    minConfidenceScore: filters.minConfidenceScore,
                    page: 1,
                  })
                }
                onReset={() =>
                  updateQueryParams({
                    min_views: "",
                    publishedFrom: "",
                    publishedTo: "",
                    trendStage: "",
                    regionCode: "",
                    source: "NICHE",
                    categoryTitle: "",
                    minScore: "",
                    minSpeedScore: "",
                    minBreakoutScore: "",
                    minEngagementScore: "",
                    minConfidenceScore: "",
                    page: 1,
                  })
                }
              />

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

                <Button
                  onClick={handleManualScan}
                  disabled={scanningNiche}
                  //className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scanningNiche ? "Scanning" : "Scan Now"}
                </Button>


              </div>
            </div>

            <div className="space-y-4 pb-20">
              {loadingVideos ? (
                Array.from({ length: 3 }, (_, index) => <VideoCardSkeleton key={index} />)
              ) : videoError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {videoError}
                </div>
              ) : videos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                  No videos match the selected niche and filters.
                </div>
              ) : (
                videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onVideoUpdated={(updatedVideo) =>
                      setVideos((current) =>
                        current.map((item) => item.id === updatedVideo.id ? updatedVideo : item)
                      )
                    }
                  />
                ))
              )}
            </div>

            <VideoPaginationControls
              pagination={videoPagination}
              pageSize={pageSize}
              disabled={loadingVideos}
              onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
              onPageSizeChange={(nextSize) =>
                updateQueryParams({ size: nextSize, page: 1 })
              }
            />
          </>
        )}
      </ProtectedPageShell>

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
    </>
  );
}

export default function NichesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NichesPageContent />
    </Suspense>
  );
}


