"use client";

import Button from "@/components/ui/Button";
import { VideoDays, VideosPagination, VideoSort } from "@/types/types";

export type SortDirection = "asc" | "desc";
export type VideoSortDirections = Partial<Record<VideoSort, SortDirection>>;

export const VIDEO_SORT_OPTIONS: Array<{ value: VideoSort; label: string }> = [
  { value: "score", label: "Trending score" },
  { value: "trend_stage", label: "Trend stage" },
  { value: "speed_score", label: "Speed score" },
  { value: "breakout_score", label: "Breakout score" },
  { value: "engagement", label: "Engagement score" },
  { value: "views", label: "Views" },
  { value: "published_at", label: "Published at" },
  { value: "region", label: "Region" },
  { value: "source", label: "Source" },
  { value: "category_title", label: "Category" },
  { value: "confidence_score", label: "Confidence score" },
];

const DAY_OPTIONS: Array<{ value: VideoDays; label: string }> = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
];

type VideoFiltersProps = {
  sortDirections: VideoSortDirections;
  minViews: string;
  days: VideoDays | "";
  onChange: (filters: Partial<{ sortDirections: VideoSortDirections; minViews: string; days: VideoDays | "" }>) => void;
  onReset: () => void;
};

export default function VideoFilters({
  sortDirections,
  minViews,
  days,
  onChange,
  onReset,
}: VideoFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="Video filters">
      <fieldset className="rounded border border-gray-200 bg-white px-3 py-2">
        <legend className="px-1 text-sm text-gray-600">Sort fields</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3 xl:grid-cols-4">
          {VIDEO_SORT_OPTIONS.map((option) => {
            const direction = sortDirections[option.value] ?? "";

            return (
              <label key={option.value} className="flex min-w-0 flex-col gap-1 text-xs text-gray-700">
                <span className="truncate">{option.label}</span>
                <select
                  value={direction}
                  onChange={(event) => {
                    const nextDirections = { ...sortDirections };
                    const nextDirection = event.target.value as SortDirection | "";

                    if (nextDirection) {
                      nextDirections[option.value] = nextDirection;
                    } else {
                      delete nextDirections[option.value];
                    }

                    onChange({
                      sortDirections: nextDirections,
                    });
                  }}
                  className="min-w-0 rounded border px-1.5 py-1 text-xs text-gray-900"
                >
                  <option value="">Not sorted</option>
                  <option value="desc">High to low</option>
                  <option value="asc">Low to high</option>
                </select>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Minimum views
        <input
          type="number"
          min="0"
          inputMode="numeric"
          placeholder="0"
          value={minViews}
          onChange={(event) => onChange({ minViews: event.target.value })}
          className="w-32 rounded border px-2 py-1 text-sm text-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Published
        <select
          value={days}
          onChange={(event) =>
            onChange({
              days: event.target.value ? (Number(event.target.value) as VideoDays) : "",
            })
          }
          className="rounded border px-2 py-1 text-sm text-gray-900"
        >
          <option value="">All time</option>
          {DAY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Button type="button" variant="secondary" className="w-auto px-2 py-1 text-xs" onClick={onReset}>
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
