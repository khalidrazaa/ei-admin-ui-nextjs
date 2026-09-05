"use client";

import { useState } from "react";
import VideoTranscriptAction from "./VideoTranscriptAction";
import type { ReactNode } from "react";

import { PopularVideo, TrendVideo, VideoTrendStage } from "@/types/types";
import {
  formatCompactNumber,
  formatFixedNumber,
  formatHours,
  formatMultiplier,
  formatRelativeTime,
} from "@/lib/utils/formatters";

type Props = {
  video: TrendVideo | PopularVideo;
  onVideoUpdated?: (video: PopularVideo) => void;
  sidebarActions?: ReactNode;
  sidebarMessage?: ReactNode;
};

const stageStyles: Record<VideoTrendStage, string> = {
  trending: "bg-rose-100 text-rose-700 border-rose-200",
  breakout: "bg-orange-100 text-orange-700 border-orange-200",
  emerging: "bg-sky-100 text-sky-700 border-sky-200",
  sustained_demand: "bg-violet-100 text-violet-700 border-violet-200",
  watchlist: "bg-slate-100 text-slate-700 border-slate-200",
};

function stageLabel(stage: string | null): string {
  if (!stage) {
    return "Unclassified";
  }

  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function MetricChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "blue" | "amber" | "purple";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {label} {value}
    </span>
  );
}

export default function VideoCard({ video: initialVideo, onVideoUpdated, sidebarActions, sidebarMessage }: Props) {
  const [savedVideo, setSavedVideo] = useState<{ original: typeof initialVideo; updated: PopularVideo } | null>(null);
  const video = savedVideo?.original === initialVideo ? savedVideo.updated : initialVideo;
  const trendStage = video.trend_stage ?? "watchlist";
  const stageTone = stageStyles[trendStage as VideoTrendStage] ?? stageStyles.watchlist;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-2 md:w-40">
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <img
              src={video.thumbnail_url}
              className="h-24 w-full rounded-lg object-cover"
              alt={video.title}
            />
          </a>

          <VideoTranscriptAction video={video} onVideoUpdated={(updated) => {
            setSavedVideo({ original: initialVideo, updated });
            onVideoUpdated?.(updated);
          }} />
          {sidebarActions && <div className="flex flex-col gap-2">{sidebarActions}</div>}
          {sidebarMessage}
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <a
              href={video.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 font-semibold text-gray-900 hover:text-blue-700"
            >
              {video.title}
            </a>

            <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-gray-500">
              <span>{video.channel_title}</span>
              {video.channel_country && <span>| {video.channel_country}</span>}
              <span>| {formatRelativeTime(video.published_at)}</span>
              <span>| age {formatHours(video.age_hours)}</span>
              <span>| Likes {formatCompactNumber(video.like_count ?? 0)}</span>
              <span>| Comments {formatCompactNumber(video.comment_count ?? 0)}</span>
              {video.views_vs_subscribers !== null && (
                <span>| Views/Subs {formatMultiplier(video.views_vs_subscribers)}</span>
              )}
              {video.source && <span>| {video.source}</span>}
              {video.region_code && <span>| {video.region_code}</span>}
              <span>| Scanned {formatRelativeTime(video.scanned_at)}</span>
            </p>
          </div>

          {video.description && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{video.description}</p>
          )}

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <MetricChip label="Views" value={formatCompactNumber(video.view_count)} />
              <MetricChip
                label="VPH"
                value={formatCompactNumber(video.views_per_hour)}
                tone="blue"
              />
              <MetricChip
                label="Score"
                value={formatFixedNumber(video.virality_score, 1)}
                tone="green"
              />
              <MetricChip
                label="Breakout"
                value={formatFixedNumber(video.breakout_score, 1)}
                tone="amber"
              />
              <MetricChip
                label="Engage"
                value={formatFixedNumber(video.engagement_score, 1)}
                tone="purple"
              />
              {video.category_title && (
                <MetricChip label="Category" value={video.category_title} tone="neutral" />
              )}
            </div>

            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${stageTone}`}>
                {stageLabel(video.trend_stage)}
              </span>
              {video.has_transcript && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Transcript Ready
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="font-medium text-gray-700">Creator Baseline</div>
              <div className="mt-1">
                Avg views {formatCompactNumber(video.channel_avg_views)}
              </div>
              <div>Vs avg {formatMultiplier(video.views_vs_channel_average)}</div>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="font-medium text-gray-700">Engagement</div>
              <div className="mt-1">
                Likes/1k {formatFixedNumber(video.likes_per_1k_views, 1)}
              </div>
              <div>Comments/1k {formatFixedNumber(video.comments_per_1k_views, 1)}</div>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="font-medium text-gray-700">Creator Size</div>
              <div className="mt-1">
                Subs{" "}
                {video.hidden_subscriber_count
                  ? "Hidden"
                  : formatCompactNumber(video.subscriber_count)}
              </div>
              <div>
                Videos {formatCompactNumber(video.channel_video_count ?? 0)}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="font-medium text-gray-700">Signal Mix</div>
              <div className="mt-1">
                Speed {formatFixedNumber(video.speed_score, 1)}
              </div>
              <div>
                Confidence {formatFixedNumber(video.confidence_score, 1)}
              </div>
            </div>
          </div>

          {video.transcript_language && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span>Transcript {video.transcript_language}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
