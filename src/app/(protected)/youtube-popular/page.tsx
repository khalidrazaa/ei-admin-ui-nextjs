"use client";

import { useEffect, useMemo, useState } from "react";

import VideoCard from "@/components/ui/VideoCard";
import Button from "@/components/ui/Button";
import {
  getPopularVideos,
  scanPopularVideos,
} from "@/lib/services/popular-videos";
import { VideoDays, VideoSort } from "@/lib/services/scaned-trends";
import { PopularVideo } from "@/types/types";

const SORT_OPTIONS: VideoSort[] = ["score", "views", "recent"];
const DAY_OPTIONS: VideoDays[] = [7, 30];
const REGION_OPTIONS = [
  { label: "All Regions", value: "" },
  { label: "United States", value: "US" },
  { label: "India", value: "IN" },
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
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [sort, setSort] = useState<VideoSort>("score");
  const [minViews, setMinViews] = useState("");
  const [days, setDays] = useState<VideoDays | "">("");
  const [regionCode, setRegionCode] = useState("");

  const filters = useMemo(
    () => ({
      sort,
      min_views: minViews ? Number(minViews) : undefined,
      days: days === "" ? null : days,
      region_code: regionCode || undefined,
    }),
    [days, minViews, regionCode, sort]
  );

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

  async function handleScanNow() {
    try {
      setScanning(true);
      setMessage("Scanning and refreshing popular YouTube videos...");
      setMessageType(null);

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

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Youtube Popular</h1>
          <p className="text-sm text-gray-500">
            Stored popular videos scanned from YouTube and saved in the system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {message && (
            <span
              className={`text-sm ${
                messageType === "error"
                  ? "text-red-600"
                  : messageType === "success"
                    ? "text-green-700"
                    : "text-gray-600"
              }`}
            >
              {message}
            </span>
          )}

          <Button onClick={handleScanNow} disabled={scanning}>
            {scanning ? "Scanning..." : "Scan Now"}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as VideoSort)}
          className="rounded border px-2 py-1 text-sm"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "score"
                ? "Score"
                : option === "views"
                  ? "Views"
                  : "Recent"}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="0"
          inputMode="numeric"
          placeholder="Min views"
          value={minViews}
          onChange={(e) => setMinViews(e.target.value)}
          className="w-32 rounded border px-2 py-1 text-sm"
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
            <div key={video.id}>
              <div className="mb-2 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                  Source {video.source}
                </span>
                {video.region_code && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                    Region {video.region_code}
                  </span>
                )}
              </div>
              <VideoCard video={video} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
