import type { VideoFilterValues } from "@/components/ui/VideoFilters";
import type { VideoListParams } from "@/types/types";

export const EMPTY_VIDEO_FILTERS: VideoFilterValues = {
  minViews: "", publishedFrom: "", publishedTo: "", trendStage: "",
  regionCode: "", source: "", categoryTitle: "", minScore: "",
  minSpeedScore: "", minBreakoutScore: "", minEngagementScore: "", minConfidenceScore: "",
};

export function toVideoListParams(filters: VideoFilterValues, page: number, size: number): VideoListParams {
  const number = (value: string) => value === "" ? undefined : Number(value);
  const values = (value: string) => value ? [value] : [];
  return {
    min_views: number(filters.minViews),
    published_from: filters.publishedFrom || undefined,
    published_to: filters.publishedTo || undefined,
    trend_stage: filters.trendStage ? [filters.trendStage] : [],
    region_code: values(filters.regionCode),
    source: values(filters.source),
    category_title: values(filters.categoryTitle),
    min_score: number(filters.minScore),
    min_speed_score: number(filters.minSpeedScore),
    min_breakout_score: number(filters.minBreakoutScore),
    min_engagement_score: number(filters.minEngagementScore),
    min_confidence_score: number(filters.minConfidenceScore),
    page, size,
  };
}
