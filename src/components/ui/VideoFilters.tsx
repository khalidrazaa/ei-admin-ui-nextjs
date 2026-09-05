"use client";

import Button from "@/components/ui/Button";
import {
  VideosPagination,
  VideoTrendStage,
} from "@/types/types";

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
export const CATEGORY_OPTIONS = [
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

const DATE_OPTIONS = Array.from({ length: 365 }, (_, offset) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);

  return {
    value: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }),
  };
});

export type VideoFilterValues = {
  minViews: string;
  publishedFrom: string;
  publishedTo: string;
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
  lockSource?: boolean;
};

export default function VideoFilters({
  minViews,
  publishedFrom,
  publishedTo,
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
  lockSource = false,
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
      options: SOURCE_OPTIONS.map((value) => ({
        value,
        label: lockSource && value === "NICHE" ? "Niche" : value,
      })),
    },
    {
      key: "categoryTitle",
      label: "Category",
      value: categoryTitle,
      options: CATEGORY_OPTIONS.map((value) => ({ value, label: value })),
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
        disabled={filter.key === "source" && lockSource}
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

      <label className="min-w-36 flex-1 text-xs text-gray-600 sm:flex-none">
        <span className="mb-1 block truncate">Published from</span>
        <select
          value={publishedFrom}
          onChange={(event) => onChange({ publishedFrom: event.target.value })}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="">Any date</option>
          {DATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-36 flex-1 text-xs text-gray-600 sm:flex-none">
        <span className="mb-1 block truncate">Published to</span>
        <select
          value={publishedTo}
          onChange={(event) => onChange({ publishedTo: event.target.value })}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="">Any date</option>
          {DATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <details className="group relative">
        <summary className="cursor-pointer list-none rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50">
          Advanced filters
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 grid w-[min(34rem,calc(100vw-2rem))] grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:grid-cols-2 lg:grid-cols-3">
          {advancedFilters.map(renderFilter)}
        </div>
      </details>

      <Button
        type="button"
        variant="secondary"
        className="!w-auto shrink-0 whitespace-nowrap !py-1.5 !text-sm"
        onClick={onReset}
      >
        Reset
      </Button>
    </div>
  );
}

type VideoPaginationControlsProps = {
  pagination: VideosPagination;
  pageSize?: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}; 

export function VideoPaginationControls({
  pagination,
  pageSize = pagination.size,
  disabled = false,
  onPageChange,
  onPageSizeChange,
}: VideoPaginationControlsProps) {
  if (pagination.total === 0) {
    return null;
  }

  const firstItem = (pagination.page - 1) * pagination.size + 1;
  const lastItem = Math.min(pagination.page * pagination.size, pagination.total);

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <p>
          Showing <span className="font-medium text-gray-700">{firstItem}</span> to{" "}
          <span className="font-medium text-gray-700">{lastItem}</span> of{" "}
          <span className="font-medium text-gray-700">{pagination.total}</span> videos
        </p>

        {onPageSizeChange ? (
          <label className="flex items-center gap-2 whitespace-nowrap">
            Per page
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="!w-auto shrink-0 whitespace-nowrap text-sm"
          disabled={disabled || !pagination.has_prev}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Previous
        </Button>
        <span className="shrink-0 whitespace-nowrap px-2 text-sm text-gray-600">
          Page <span className="font-medium text-gray-900">{pagination.page}</span> of{" "}
          <span className="font-medium text-gray-900">{pagination.pages}</span>
        </span>
        <Button
          type="button"
          className="!w-auto shrink-0 whitespace-nowrap text-sm"
          disabled={disabled || !pagination.has_next}
          onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
