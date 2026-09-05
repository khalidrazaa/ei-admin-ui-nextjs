"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Toast from "@/components/ui/Toast";
import Sidebar from "@/components/ui/Sidebar";
import VideoFilters, { CATEGORY_OPTIONS, VideoFilterValues, VideoPaginationControls } from "@/components/ui/VideoFilters";
import { EMPTY_VIDEO_FILTERS, toVideoListParams } from "@/lib/utils/videoFilters";
import VideoCard from "@/components/ui/VideoCard";
import {
  getPopularScanSettings,
  getPopularVideos,
  scanPopularVideos,
} from "@/lib/services/videos";
import { VideosPagination } from "@/types/types";
import {
  PopularScanSettings,
  PopularVideo,
} from "@/types/types";

const ALL_CATEGORIES = "all";
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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [filterValues, setFilterValues] = useState<VideoFilterValues>(EMPTY_VIDEO_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pagination, setPagination] = useState<VideosPagination>({
    page: 1, size: 20, total: 0, pages: 1, has_prev: false, has_next: false,
  });
  const filters = useMemo(
    () => toVideoListParams(filterValues, page, pageSize),
    [filterValues, page, pageSize]
  );
  function changeFilters(changes: Partial<VideoFilterValues>) {
    setFilterValues((current) => ({ ...current, ...changes }));
    setPage(1);
  }

  const categories = [
    { key: ALL_CATEGORIES, label: "All Categories" },
    ...Array.from(new Set([...CATEGORY_OPTIONS, ...videos.map((video) => video.category_title).filter((value): value is string => Boolean(value)), filterValues.categoryTitle].filter(Boolean)))
      .sort().map((value) => ({ key: value, label: value })),
  ];

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
    let cancelled = false;
    async function loadVideos() {
      try {
        setLoading(true);
        const data = await getPopularVideos(filters);
        if (cancelled) return;
        setVideos(data.items);
        setPagination(data.pagination);
        if (data.pagination.pages > 0 && page > data.pagination.pages) setPage(data.pagination.pages);
      } catch (err) {
        if (cancelled) return;
        setVideos([]);
        setPagination((current) => ({ ...current, total: 0, has_next: false, has_prev: false }));
        console.error("Failed to load popular videos", err);
        setMessage("Failed to load popular videos");
        setMessageType("error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadVideos();
    return () => { cancelled = true; };
  }, [filters, page, reloadVersion]);

  useEffect(() => {
    async function loadPopularScanConfig() {
      try {
        setSettingsLoading(true);
        const settings = await getPopularScanSettings();
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

  async function handleScanNow() {
    try {
      setScanning(true);
      setMessage("Scanning popular YouTube videos with current settings...");
      setMessageType("info");

      const result = await scanPopularVideos(scanSettings);
      setReloadVersion((version) => version + 1);
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


  return (
    <ProtectedPageShell
      title="Youtube Popular"
      description="Browse popular videos by category."
      contentClassName="flex-1 overflow-y-auto px-4"
      sidebar={
        <Sidebar items={categories.map((category) => ({
          id: category.key,
          label: category.label,
          isActive: (filterValues.categoryTitle || ALL_CATEGORIES) === category.key,
          onClick: () => changeFilters({ categoryTitle: category.key === ALL_CATEGORIES ? "" : category.key }),
        }))} />
      }
    >
        <div className="sticky top-0 z-20 -mx-4 mb-1 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <VideoFilters
            {...filterValues}
            onChange={changeFilters}
            onReset={() => { setFilterValues(EMPTY_VIDEO_FILTERS); setPage(1); }}
          />

          <Button
            onClick={handleScanNow}
            disabled={scanning || settingsLoading || scanSettings.region_codes.length === 0}
          >
            {scanning ? "Scanning" : "Scan Now"}
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <VideoCardSkeleton key={index} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            No popular videos found for the current filters.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} onVideoUpdated={(updatedVideo) =>
                setVideos((current) => current.map((item) => item.id === updatedVideo.id ? updatedVideo : item))
              } />
            ))}
          </div>
        )}


        <VideoPaginationControls
          pagination={pagination}
          pageSize={pageSize}
          disabled={loading}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />

        <Toast
          message={message}
          type={messageType}
          onClose={() => {
            setMessage(null);
            setMessageType(null);
          }}
        />
    </ProtectedPageShell>
  );
}
