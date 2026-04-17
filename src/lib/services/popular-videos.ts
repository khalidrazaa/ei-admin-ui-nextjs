import { apiFetch } from "@/lib/api";
import { PopularVideo } from "@/types/types";
import { VideoDays, VideoSort } from "@/lib/services/scaned-trends";

export type PopularVideoFilters = {
  sort?: VideoSort;
  min_views?: number;
  days?: VideoDays | null;
  region_code?: string;
  source?: string;
};

export async function getPopularVideos(
  params: PopularVideoFilters = {}
): Promise<PopularVideo[]> {
  const query = new URLSearchParams();

  if (params.sort) query.append("sort", params.sort);
  if (params.min_views) query.append("min_views", String(params.min_views));
  if (params.days) query.append("days", String(params.days));
  if (params.region_code) query.append("region_code", params.region_code);
  if (params.source) query.append("source", params.source);

  return apiFetch(
    `/admin/youtube-scan/popular/videos?${query.toString()}`,
    { method: "GET" }
  ) as Promise<PopularVideo[]>;
}

export async function scanPopularVideos(): Promise<{ status: string }> {
  return apiFetch("/admin/youtube-scan/popular/scan", {
    method: "POST",
  }) as Promise<{ status: string }>;
}
