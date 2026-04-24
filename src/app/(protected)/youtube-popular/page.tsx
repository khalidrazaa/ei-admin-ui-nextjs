"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import TranscriptModal from "@/components/ui/TranscriptModal";
import VideoCard from "@/components/ui/VideoCard";
import {
  generateDraftArticle,
  getPopularScanRegions,
  getPopularScanSettings,
  getVideoTranscript,
  getPopularVideos,
  saveVideoTranscript,
  scanPopularVideos,
  updatePopularScanSettings,
} from "@/lib/services/popular-videos";
import { VideoDays, VideoSort } from "@/lib/services/scaned-trends";
import {
  formatCompactNumber,
  formatFixedNumber,
} from "@/lib/utils/formatters";
import {
  PopularScanSettings,
  PopularVideo,
  VideoTranscript,
  YouTubeRegion,
} from "@/types/types";

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
const ALL_CATEGORIES = "all";
const SOURCE_OPTIONS = [
  { label: "All Videos", value: "all" },
  { label: "Popular", value: "POPULAR" },
  { label: "Niche", value: "NICHE" },
];
const DEFAULT_SCAN_SETTINGS: PopularScanSettings = {
  region_codes: ["US"],
  max_results: 10,
};

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
  const [scanSettings, setScanSettings] = useState<PopularScanSettings>(DEFAULT_SCAN_SETTINGS);
  const [availableRegions, setAvailableRegions] = useState<YouTubeRegion[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");
  const [transcriptReadLoadingId, setTranscriptReadLoadingId] = useState<number | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptSaving, setTranscriptSaving] = useState(false);
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

  const regionOptions = useMemo(
    () => [
      { label: "All Regions", value: "" },
      ...availableRegions.map((region) => ({
        label: region.name,
        value: region.code,
      })),
    ],
    [availableRegions]
  );

  const filteredAvailableRegions = useMemo(() => {
    const search = regionSearch.trim().toLowerCase();
    if (!search) {
      return availableRegions;
    }

    return availableRegions.filter((region) => {
      const haystack = `${region.name} ${region.code}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [availableRegions, regionSearch]);

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
    async function loadPopularScanConfig() {
      try {
        setSettingsLoading(true);
        const [regions, settings] = await Promise.all([
          getPopularScanRegions(),
          getPopularScanSettings(),
        ]);
        setAvailableRegions(regions);
        setScanSettings({
          region_codes: settings.region_codes,
          max_results: settings.max_results,
        });
      } catch (err) {
        console.error("Failed to load popular scan settings", err);
        setMessage("Failed to load popular scan settings");
        setMessageType("error");
      } finally {
        setSettingsLoading(false);
      }
    }

    void loadPopularScanConfig();
  }, []);

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
      setMessage("Scanning popular YouTube videos with current settings...");
      setMessageType("info");

      const result = await scanPopularVideos(scanSettings);
      const refreshed = await getPopularVideos(filters);
      setVideos(refreshed);
      const regionSummary =
        result.regions.length <= 4
          ? result.regions.join(", ")
          : `${result.regions.slice(0, 4).join(", ")} +${result.regions.length - 4} more`;

      setMessage(
        `Popular scan completed for ${regionSummary} with ${result.max_results} results per region. Processed ${result.total_processed} videos.`
      );
      setMessageType("success");
    } catch (err) {
      console.error("Failed to scan popular videos", err);
      setMessage("Failed to scan popular videos");
      setMessageType("error");
    } finally {
      setScanning(false);
    }
  }

  function toggleScanRegion(regionCode: string) {
    setScanSettings((current) => {
      const exists = current.region_codes.includes(regionCode);
      return {
        ...current,
        region_codes: exists
          ? current.region_codes.filter((code) => code !== regionCode)
          : [...current.region_codes, regionCode],
      };
    });
  }

  async function handleSaveScanSettings() {
    try {
      setSettingsSaving(true);
      setMessage("Saving popular scan settings...");
      setMessageType("info");

      const saved = await updatePopularScanSettings(scanSettings);
      setScanSettings(saved);
      setMessage("Popular scan settings saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save popular scan settings", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to save popular scan settings"
      );
      setMessageType("error");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleOpenTranscript(video: PopularVideo) {
    setActiveTranscript({
      id: video.id,
      title: video.title,
      youtube_video_id: video.youtube_video_id,
      transcript_text: "",
      transcript_language: video.transcript_language,
      transcript_source: video.transcript_source,
      transcript_fetched_at: video.transcript_fetched_at,
    });
    setTranscriptOpen(true);

    if (!video.has_transcript) {
      setTranscriptLoading(false);
      return;
    }

    try {
      setTranscriptReadLoadingId(video.id);
      setTranscriptLoading(true);
      setMessage("Loading transcript...");
      setMessageType("info");

      const transcript = await getVideoTranscript(video.id);
      setActiveTranscript(transcript);
      setMessage(null);
      setMessageType(null);
    } catch (err) {
      console.error("Failed to load transcript", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to load transcript"
      );
      setMessageType("error");
    } finally {
      setTranscriptLoading(false);
      setTranscriptReadLoadingId(null);
    }
  }

  async function handleSaveTranscript(transcriptText: string) {
    if (!activeTranscript) {
      return;
    }

    try {
      setTranscriptSaving(true);
      setMessage("Saving transcript...");
      setMessageType("info");

      const updatedVideo = await saveVideoTranscript(activeTranscript.id, transcriptText);
      setVideos((current) =>
        current.map((video) => (video.id === updatedVideo.id ? updatedVideo : video))
      );
      setActiveTranscript((current) =>
        current
          ? {
              ...current,
              transcript_text: transcriptText.trim(),
              transcript_language: updatedVideo.transcript_language,
              transcript_source: updatedVideo.transcript_source,
              transcript_fetched_at: updatedVideo.transcript_fetched_at,
            }
          : current
      );
      setMessage("Transcript saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save transcript", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to save transcript"
      );
      setMessageType("error");
    } finally {
      setTranscriptSaving(false);
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
              {regionOptions.map((option) => (
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

          <Button
            onClick={handleScanNow}
            disabled={scanning || settingsLoading || scanSettings.region_codes.length === 0}
          >
            {scanning ? "Scanning" : "Scan Now"}
          </Button>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Popular Scan Settings</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose the regions to scan and how many popular videos to fetch per
                region.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  setScanSettings((current) => ({
                    ...current,
                    region_codes: availableRegions.map((region) => region.code),
                  }))
                }
                disabled={settingsLoading || availableRegions.length === 0}
                className="px-3 py-2 text-sm"
              >
                Select All
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveScanSettings()}
                disabled={settingsLoading || settingsSaving || scanSettings.region_codes.length === 0}
                className="px-3 py-2 text-sm"
              >
                {settingsSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Results per region
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={scanSettings.max_results}
                onChange={(e) => {
                  const nextValue = Number(e.target.value);
                  setScanSettings((current) => ({
                    ...current,
                    max_results: Number.isFinite(nextValue)
                      ? Math.max(1, Math.min(50, nextValue))
                      : 1,
                  }));
                }}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <div className="mt-2 text-xs text-gray-500">
                YouTube allows up to 50 results per request.
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Regions
                </label>
                <input
                  type="text"
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  placeholder="Search regions"
                  className="w-full rounded border px-3 py-2 text-sm sm:w-56"
                />
              </div>

              <div className="mb-2 text-xs text-gray-500">
                Selected {scanSettings.region_codes.length} region
                {scanSettings.region_codes.length === 1 ? "" : "s"}
              </div>

              {settingsLoading ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Loading available regions from YouTube...
                </div>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredAvailableRegions.map((region) => {
                    const checked = scanSettings.region_codes.includes(region.code);

                    return (
                      <label
                        key={region.code}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                          checked
                            ? "border-blue-300 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScanRegion(region.code)}
                        />
                        <span className="min-w-0">
                          {region.name} ({region.code})
                        </span>
                      </label>
                    );
                  })}

                  {filteredAvailableRegions.length === 0 ? (
                    <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      No regions match your search.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
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
                    <Button
                      variant="secondary"
                      onClick={() => void handleOpenTranscript(video)}
                      disabled={transcriptReadLoadingId === video.id}
                      className="text-sm"
                    >
                      {transcriptReadLoadingId === video.id
                        ? "Opening..."
                        : "Transcript"}
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}

        <TranscriptModal
          open={transcriptOpen}
          transcript={activeTranscript}
          loadingTranscript={transcriptLoading}
          savingTranscript={transcriptSaving}
          creatingDraft={draftLoadingId === activeTranscript?.id}
          onSaveTranscript={(transcriptText) => {
            void handleSaveTranscript(transcriptText);
          }}
          onCreateDraft={() => {
            if (activeTranscript) {
              void handleGenerateDraft(activeTranscript.id);
            }
          }}
          onClose={() => {
            setTranscriptLoading(false);
            setTranscriptSaving(false);
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
