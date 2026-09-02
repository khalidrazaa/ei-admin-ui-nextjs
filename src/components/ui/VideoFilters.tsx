"use client";

import Button from "@/components/ui/Button";
import {
  PublishedAge,
  VideosPagination,
  VideoTrendStage,
} from "@/types/types";

const PUBLISHED_OPTIONS: Array<{ value: PublishedAge; label: string }> = [
  { value: "6h", label: "Last 6 hours" },
  { value: "12h", label: "Last 12 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "2d", label: "Last 2 days" },
  { value: "3d", label: "Last 3 days" },
  { value: "4d", label: "Last 4 days" },
  { value: "5d", label: "Last 5 days" },
  { value: "6d", label: "Last 6 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "7d+", label: "Older than 7 days" },
];

const TREND_STAGE_OPTIONS: Array<{ value: VideoTrendStage; label: string }> = [
  { value: "watchlist", label: "Watchlist" },
  { value: "emerging", label: "Emerging" },
  { value: "breakout", label: "Breakout" },
  { value: "trending", label: "Trending" },
  { value: "sustained_demand", label: "Sustained demand" },
];

const SCORE_OPTIONS = [2.5, 5, 7.5, 9];
const VIEW_OPTIONS = [1000, 10000, 100000, 1000000];
const REGION_OPTIONS = ["IN", "US", "GB", "CA", "AU"];
const SOURCE_OPTIONS = ["NICHE", "POPULAR", "MANUAL"];
const CATEGORY_OPTIONS = [
  "Autos & Vehicles",
  "Comedy",
  "Education",
  "Entertainment",
  "Film & Animation",
  "Gaming",
  "Howto & Style",
  "Music",
  "News & Politics",
  "People & Blogs",
  "Pets & Animals",
  "Science & Technology",
  "Sports",
  "Travel & Events",
  "Unknown",
];

export type VideoFilterValues = {
  minViews: string;
  publishedAge: PublishedAge | "";
  trendStage: VideoTrendStage | "";
  regionCode: string;
  source: string;
  categoryTitle: string;
  minScore: string;
  minSpeedScore: string;
  minBreakoutScore: string;
  minEngagementScore: string;
  minConfidenceScore: string;
};

type VideoFiltersProps = VideoFilterValues & {
  onChange: (filters: Partial<VideoFilterValues>) => void;
  onReset: () => void;
};

export default function VideoFilters({
  minViews,
  publishedAge,
  trendStage,
  regionCode,
  source,
  categoryTitle,
  minScore,
  minSpeedScore,
  minBreakoutScore,
  minEngagementScore,
  minConfidenceScore,
  onChange,
  onReset,
}: VideoFiltersProps) {
  const primaryFilters = [
    {
      key: "trendStage",
      label: "Trend stage",
      value: trendStage,
      options: TREND_STAGE_OPTIONS,
    },
    {
      key: "regionCode",
      label: "Region",
      value: regionCode,
      options: REGION_OPTIONS.map((value) => ({ value, label: value })),
    },
    {
      key: "source",
      label: "Source",
      value: source,
      options: SOURCE_OPTIONS.map((value) => ({ value, label: value })),
    },
    {
      key: "categoryTitle",
      label: "Category",
      value: categoryTitle,
      options: CATEGORY_OPTIONS.map((value) => ({ value, label: value })),
    },
    {
      key: "publishedAge",
      label: "Published",
      value: publishedAge,
      options: PUBLISHED_OPTIONS,
    },
  ] as const;

  const advancedFilters = [
    {
      key: "minScore",
      label: "Trending score",
      value: minScore,
      options: SCORE_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
    },
    {
      key: "minSpeedScore",
      label: "Speed score",
      value: minSpeedScore,
      options: SCORE_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
    },
    {
      key: "minBreakoutScore",
      label: "Breakout score",
      value: minBreakoutScore,
      options: SCORE_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
    },
    {
      key: "minEngagementScore",
      label: "Engagement",
      value: minEngagementScore,
      options: SCORE_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
    },
    {
      key: "minViews",
      label: "Views",
      value: minViews,
      options: VIEW_OPTIONS.map((value) => ({ value: String(value), label: `${value.toLocaleString()}+` })),
    },
    {
      key: "minConfidenceScore",
      label: "Confidence",
      value: minConfidenceScore,
      options: SCORE_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
    },
  ] as const;

  const renderFilter = (filter: (typeof primaryFilters)[number] | (typeof advancedFilters)[number]) => (
    <label key={filter.key} className="min-w-32 flex-1 text-xs text-gray-600 sm:flex-none">
      <span className="mb-1 block truncate">{filter.label}</span>
      <select
        value={filter.value}
        onChange={(event) => {
          const value = event.target.value;
          onChange({
            [filter.key]: value,
          });
        }}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
      >
        <option value="">All</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-1 flex-wrap items-end gap-2" aria-label="Video filters">
      {primaryFilters.map(renderFilter)}

      <details className="group relative">
        <summary className="cursor-pointer list-none rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50">
          Advanced filters
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 grid w-[min(34rem,calc(100vw-2rem))] grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:grid-cols-2 lg:grid-cols-3">
          {advancedFilters.map(renderFilter)}
        </div>
      </details>

      <Button type="button" variant="secondary" className="w-auto px-3 py-1.5 text-xs" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

type VideoPaginationControlsProps = {
  pagination: VideosPagination;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}; 

export function VideoPaginationControls({
  pagination,
  disabled = false,
  onPageChange,
}: VideoPaginationControlsProps) {
  if (pagination.total === 0) {
    return null;
  }

  const firstItem = (pagination.page - 1) * pagination.size + 1;
  const lastItem = Math.min(pagination.page * pagination.size, pagination.total);

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{firstItem}</span> to{" "}
        <span className="font-medium text-gray-700">{lastItem}</span> of{" "}
        <span className="font-medium text-gray-700">{pagination.total}</span> videos
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-auto text-sm"
          disabled={disabled || !pagination.has_prev}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Previous
        </Button>
        <span className="px-2 text-sm text-gray-600">
          Page <span className="font-medium text-gray-900">{pagination.page}</span> of{" "}
          <span className="font-medium text-gray-900">{pagination.pages}</span>
        </span>
        <Button
          type="button"
          className="text-sm"
          disabled={disabled || !pagination.has_next}
          onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
