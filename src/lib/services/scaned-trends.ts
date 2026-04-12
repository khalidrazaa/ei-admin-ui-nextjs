
import { apiFetch } from "@/lib/api";
import { TrendVideo } from "@/types/types";

export type VideoSort = "score" | "views" | "recent";
export type VideoDays = 7 | 30;

export type VideoFilters = {
  sort?: VideoSort;
  min_views?: number;
  days?: VideoDays | null;
};

export async function getVideosByKeyword(
  keyword_id: number,
  params: VideoFilters = {}
): Promise<TrendVideo[]> {

  console.log("Fetching videos with params:");
  
  const query = new URLSearchParams();

  if (params.sort) query.append("sort", params.sort);
  if (params.min_views) query.append("min_views", String(params.min_views));
  if (params.days) query.append("days", String(params.days));

  return apiFetch(
    `/admin/youtube-scan/keywords/${keyword_id}/videos?${query.toString()}`,
    {
      method: "GET",
    }
  ) as Promise<TrendVideo[]>;
}

export async function getVideosByNiche(
  nicheId: number,
  params: VideoFilters = {}
): Promise<TrendVideo[]> {
  const query = new URLSearchParams();
  if (params.sort) query.append("sort", params.sort);
  if (params.min_views) query.append("min_views", String(params.min_views));
  if (params.days) query.append("days", String(params.days));

  return apiFetch(
    `/admin/youtube-scan/niches/${nicheId}/videos?${query.toString()}`,
    { method: "GET" }
  ) as Promise<TrendVideo[]>;
}