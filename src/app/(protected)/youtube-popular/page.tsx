"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import TranscriptModal from "@/components/ui/TranscriptModal";
import VideoCard from "@/components/ui/VideoCard";
import {
  fetchVideoTranscript,
  generateDraftArticle,
  getVideoTranscript,
  getPopularVideos,
  scanPopularVideos,
} from "@/lib/services/popular-videos";
import { VideoDays, VideoSort } from "@/lib/services/scaned-trends";
import {
  formatCompactNumber,
  formatFixedNumber,
} from "@/lib/utils/formatters";
import { PopularVideo, VideoTranscript } from "@/types/types";

const SORT_OPTIONS: Array<{ value: VideoSort; label: string }> = [
  { value: "score", label: "Trending Score" },
  { value: "trending", label: "Trending" },
  { value: "breakout", label: "Breakout" },
  { value: "emerging", label: "Emerging" },
  { value: "sustained_demand", label: "Sustained Demand" },
  { value: "watchlist", label: "Watchlist" },
  { value: "vph", label: "Views / Hour" },
  { value: "breakout_score", label: "Breakout Score" },
  { value: "engagement", label: "Engagement" },
  { value: "views", label: "Views" },
  { value: "recent", label: "Recent" },
];
const DAY_OPTIONS: VideoDays[] = [7, 30];
const REGION_OPTIONS = [
  { label: "All Regions", value: "" },
  { label: "United States", value: "US" },
  { label: "India", value: "IN" },
  { label: "United Kingdom", value: "GB" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
];
const ALL_CATEGORIES = "all";
const SOURCE_OPTIONS = [
  { label: "All Videos", value: "all" },
  { label: "Popular", value: "POPULAR" },
  { label: "Niche", value: "NICHE" },
];

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

export default function YoutubePopularPage() {
  const [videos, setVideos] = useState<PopularVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(null);
  const [transcriptErrors, setTranscriptErrors] = useState<Record<number, string>>({});
  const [expandedTranscriptErrorId, setExpandedTranscriptErrorId] = useState<number | null>(null);
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<number | null>(null);
  const [transcriptReadLoadingId, setTranscriptReadLoadingId] = useState<number | null>(null);
  const [draftLoadingId, setDraftLoadingId] = useState<number | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<VideoTranscript | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [sort, setSort] = useState<VideoSort>("score");
  const [minViews, setMinViews] = useState("");
  const [days, setDays] = useState<VideoDays | "">("");
  const [regionCode, setRegionCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [sourceType, setSourceType] = useState("");

  const filters = useMemo(
    () => ({
      sort,
      min_views: minViews ? Number(minViews) : undefined,
      days: days === "" ? null : days,
      region_code: regionCode || undefined,
      source: sourceType === "all" ? undefined : sourceType || undefined,
    }),
    [days, minViews, regionCode, sort, sourceType]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    videos.forEach((video) => {
      const key = video.category_title || "uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [
      {
        key: ALL_CATEGORIES,
        label: "All Categories",
        count: videos.length,
      },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({
          key,
          label: key,
          count,
        })),
    ];
  }, [videos]);

  const visibleVideos = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) {
      return videos;
    }

    return videos.filter(
      (video) => (video.category_title || "uncategorized") === selectedCategory
    );
  }, [selectedCategory, videos]);

  const summary = useMemo(() => {
    const stageCounts = {
      trending: 0,
      breakout: 0,
      emerging: 0,
      watchlist: 0,
    };

    let totalScore = 0;
    let totalViewsPerHour = 0;

    visibleVideos.forEach((video) => {
      totalScore += video.virality_score;
      totalViewsPerHour += video.views_per_hour;

      if (video.trend_stage === "trending") stageCounts.trending += 1;
      else if (video.trend_stage === "breakout") stageCounts.breakout += 1;
      else if (video.trend_stage === "emerging") stageCounts.emerging += 1;
      else stageCounts.watchlist += 1;
    });

    return {
      total: visibleVideos.length,
      avgScore: visibleVideos.length ? totalScore / visibleVideos.length : 0,
      avgViewsPerHour: visibleVideos.length ? totalViewsPerHour / visibleVideos.length : 0,
      ...stageCounts,
    };
  }, [visibleVideos]);

  useEffect(() => {
    if (!message || messageType === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [message, messageType]);

  useEffect(() => {
    async function loadVideos() {
      try {
        setLoading(true);
        const data = await getPopularVideos(filters);
        setVideos(data);
      } catch (err) {
        console.error("Failed to load popular videos", err);
        setMessage("Failed to load popular videos");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, [filters]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORIES) {
      return;
    }

    const exists = videos.some(
      (video) => (video.category_title || "uncategorized") === selectedCategory
    );

    if (!exists) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [selectedCategory, videos]);

  async function handleScanNow() {
    try {
      setScanning(true);
      setMessage("Scanning and refreshing popular YouTube videos...");
      setMessageType("info");

      await scanPopularVideos();
      const refreshed = await getPopularVideos(filters);
      setVideos(refreshed);

      setMessage("Popular videos scan completed.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to scan popular videos", err);
      setMessage("Failed to scan popular videos");
      setMessageType("error");
    } finally {
      setScanning(false);
    }
  }

  async function handleFetchTranscript(videoId: number) {
    try {
      setTranscriptLoadingId(videoId);
      setMessage("Fetching transcript and saving it...");
      setMessageType("info");

      const updatedVideo = await fetchVideoTranscript(videoId);
      setVideos((current) =>
        current.map((video) => (video.id === videoId ? updatedVideo : video))
      );
      setTranscriptErrors((current) => {
        const next = { ...current };
        delete next[videoId];
        return next;
      });
      if (expandedTranscriptErrorId === videoId) {
        setExpandedTranscriptErrorId(null);
      }

      setMessage("Transcript fetched and stored successfully.");
      setMessageType("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch transcript";
      console.error("Failed to fetch transcript", err);
      setTranscriptErrors((current) => ({ ...current, [videoId]: errorMessage }));
      setExpandedTranscriptErrorId(videoId);
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setTranscriptLoadingId(null);
    }
  }

  async function handleReadTranscript(videoId: number) {
    try {
      setTranscriptReadLoadingId(videoId);
      setMessage("Loading transcript...");
      setMessageType("info");

      const transcript = await getVideoTranscript(videoId);
      setActiveTranscript(transcript);
      setTranscriptOpen(true);
      setMessage(null);
      setMessageType(null);
    } catch (err) {
      console.error("Failed to load transcript", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to load transcript"
      );
      setMessageType("error");
    } finally {
      setTranscriptReadLoadingId(null);
    }
  }

  async function handleGenerateDraft(videoId: number) {
    try {
      setDraftLoadingId(videoId);
      setMessage("Sending transcript to Gemini and saving a draft article...");
      setMessageType("info");

      const article = await generateDraftArticle(videoId);
      setMessage(`Draft article saved: ${article.title}`);
      setMessageType("success");
    } catch (err) {
      console.error("Failed to generate draft article", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to generate draft article"
      );
      setMessageType("error");
    } finally {
      setDraftLoadingId(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-gray-50">
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white p-4">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Youtube Popular</h1>
        </div>

        <div className="mb-4">
          <div className="space-y-2">
            {categories.map((category) => {
              const isActive = selectedCategory === category.key;

              return (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="truncate">{category.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-blue-500 text-white" : "bg-white text-gray-500"
                    }`}
                  >
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as VideoSort)}
              className="rounded border px-2 py-1 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              placeholder="Min views"
              value={minViews}
              onChange={(e) => setMinViews(e.target.value)}
              className="w-28 rounded border px-2 py-1 text-sm"
            />

            <select
              value={days}
              onChange={(e) =>
                setDays(e.target.value ? (Number(e.target.value) as VideoDays) : "")
              }
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">All time</option>
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>

          </div>

          <Button onClick={handleScanNow} disabled={scanning}>
            {scanning ? "Scanning" : "Scan Now"}
          </Button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Visible Videos
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</div>
            <div className="mt-1 text-sm text-gray-500">
              Avg score {formatFixedNumber(summary.avgScore, 1)}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Trending
            </div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">{summary.trending}</div>
            <div className="mt-1 text-sm text-gray-500">Highest confidence picks</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Breakout
            </div>
            <div className="mt-2 text-2xl font-semibold text-orange-600">{summary.breakout}</div>
            <div className="mt-1 text-sm text-gray-500">Beating creator baseline</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Emerging
            </div>
            <div className="mt-2 text-2xl font-semibold text-sky-600">{summary.emerging}</div>
            <div className="mt-1 text-sm text-gray-500">Fresh videos worth tracking</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Average VPH
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatCompactNumber(summary.avgViewsPerHour)}
            </div>
            <div className="mt-1 text-sm text-gray-500">Views per hour in result set</div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <VideoCardSkeleton key={index} />
            ))}
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            No popular videos found for the current filters.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleVideos.map((video) => (
              <div key={video.id}>
                <VideoCard
                  video={video}
                  sidebarActions={
                    <>
                      <Button
                        onClick={() => handleFetchTranscript(video.id)}
                        disabled={transcriptLoadingId === video.id}
                        className="w-full text-sm"
                      >
                        {transcriptLoadingId === video.id
                          ? "Fetching..."
                          : video.has_transcript
                            ? "Refresh Transcript"
                            : "Fetch Transcript"}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleReadTranscript(video.id)}
                        disabled={!video.has_transcript || transcriptReadLoadingId === video.id}
                        className="text-sm"
                      >
                        {transcriptReadLoadingId === video.id
                          ? "Opening..."
                          : "Read Transcript"}
                      </Button>
                    </>
                  }
                  sidebarMessage={
                    transcriptErrors[video.id] ? (
                      <div className="mt-1">
                        <button
                          type="button"
                          title={transcriptErrors[video.id]}
                          onClick={() =>
                            setExpandedTranscriptErrorId((current) =>
                              current === video.id ? null : video.id
                            )
                          }
                          className="flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700 transition hover:bg-red-100"
                        >
                          <span className="text-sm leading-none">!</span>
                          <span className="font-medium">Transcript Error</span>
                        </button>
                        {expandedTranscriptErrorId === video.id && (
                          <div className="relative mt-2">
                            <div className="absolute left-0 top-0 z-20 w-72 rounded-xl border border-red-200 bg-white px-3 py-3 text-xs text-red-700 shadow-xl">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <span className="font-semibold text-red-800">
                                  Transcript Error
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedTranscriptErrorId(null)}
                                  className="text-xs font-medium text-red-500 transition hover:text-red-700"
                                >
                                  X
                                </button>
                              </div>
                              <div>{transcriptErrors[video.id]}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}

        <TranscriptModal
          open={transcriptOpen}
          transcript={activeTranscript}
          creatingDraft={draftLoadingId === activeTranscript?.id}
          onCreateDraft={() => {
            if (activeTranscript) {
              void handleGenerateDraft(activeTranscript.id);
            }
          }}
          onClose={() => {
            setTranscriptOpen(false);
            setActiveTranscript(null);
          }}
        />

        <Toast
          message={message}
          type={messageType}
          onClose={() => {
            setMessage(null);
            setMessageType(null);
          }}
        />
      </section>
    </div>
  );
}
