import { apiFetch } from "@/lib/api";
import {  Article,
          PopularScanRunResponse,
          PopularScanSettings,
          PopularVideo,
          VideoTranscript,
          YouTubeRegion,
          GetVideosByNicheParams,
          VideosResponse,
          ApiVideosResponse,
          PopularVideoFilters  } from "@/types/types";

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
    `/admin/videos/popular?${query.toString()}`,
    { method: "GET" }
  ) as Promise<PopularVideo[]>;
}

export async function getPopularScanRegions(): Promise<YouTubeRegion[]> {
  return apiFetch("/admin/yt-scan/popular/regions", {
    method: "GET",
  }) as Promise<YouTubeRegion[]>;
}

export async function refreshPopularScanRegions(): Promise<YouTubeRegion[]> {
  return apiFetch("/admin/yt-scan/popular/regions/refresh", {
    method: "POST",
  }) as Promise<YouTubeRegion[]>;
}

export async function getPopularScanSettings(): Promise<PopularScanSettings> {
  return apiFetch("/admin/yt-scan/popular/settings", {
    method: "GET",
  }) as Promise<PopularScanSettings>;
}

export async function updatePopularScanSettings(
  settings: PopularScanSettings
): Promise<PopularScanSettings> {
  return apiFetch("/admin/yt-scan/popular/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  }) as Promise<PopularScanSettings>;
}

export async function scanPopularVideos(
  settings?: PopularScanSettings
): Promise<PopularScanRunResponse> {
  return apiFetch("/admin/yt-scan/popular/scan", {
    method: "POST",
    body: settings ? JSON.stringify(settings) : undefined,
  }) as Promise<PopularScanRunResponse>;
}

export async function saveVideoTranscript(
  videoId: number,
  transcriptText: string
): Promise<PopularVideo> {
  return apiFetch(`/admin/youtube-scan/videos/${videoId}/transcript`, {
    method: "POST",
    body: JSON.stringify({
      transcript_text: transcriptText,
    }),
  }) as Promise<PopularVideo>;
}

export async function getVideoTranscript(
  videoId: number
): Promise<VideoTranscript> {
  return apiFetch(`/admin/youtube-scan/videos/${videoId}/transcript`, {
    method: "GET",
  }) as Promise<VideoTranscript>;
}

export async function generateDraftArticle(
  videoId: number
): Promise<Article> {
  return apiFetch(`/admin/youtube-scan/videos/${videoId}/draft-article`, {
    method: "POST",
  }) as Promise<Article>;
}


export async function getVideosByKeyword(
  keyword_id: number,
  params: GetVideosByNicheParams = {}
): Promise<VideosResponse[]> {

  console.log("Fetching videos with params:");
  
  const query = new URLSearchParams();

  if (params.sort) query.append("sort", params.sort);
  if (params.min_views) query.append("min_views", String(params.min_views));
  if (params.days) query.append("days", String(params.days));

  return apiFetch(
    `/admin/videos/keywords/${keyword_id}?${query.toString()}`,
    {
      method: "GET",
    }
  ) as Promise<VideosResponse[]>;
}

export async function getVideosByNiche(
  nicheId: number,
  params: GetVideosByNicheParams = {}
): Promise<VideosResponse> {
  const searchParams = new URLSearchParams();

  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  if (
    params.min_views !== undefined &&
    params.min_views !== null
  ) {
    searchParams.set("min_views", String(params.min_views));
  }

  if (params.days !== undefined && params.days !== null) {
    searchParams.set("days", String(params.days));
  }

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("size", String(params.size ?? 20));

  const queryString = searchParams.toString();

  const response = await apiFetch<ApiVideosResponse>(
    `/admin/videos/niches/${nicheId}?${queryString}`,
    {
      method: "GET",
    }
  );

  /*
   * Support both of these backend response styles:
   *
   * 1.
   * {
   *   items: [],
   *   page: 1,
   *   size: 20,
   *   total: 100,
   *   pages: 5,
   *   has_next: true,
   *   has_prev: false
   * }
   *
   * 2.
   * {
   *   items: [],
   *   pagination: {
   *     page: 1,
   *     size: 20,
   *     total: 100,
   *     pages: 5,
   *     has_next: true,
   *     has_prev: false
   *   }
   * }
   */

  const pagination = response.pagination;

  const page = pagination?.page ?? response.page ?? params.page ?? 1;

  const size = pagination?.size ?? response.size ?? params.size ?? 20;

  const total = pagination?.total ?? response.total ?? response.items.length;

  const pages =
    pagination?.pages ??
    pagination?.total_pages ??
    response.pages ??
    response.total_pages ??
    Math.max(1, Math.ceil(total / size));

  const hasNext =
    pagination?.has_next ??
    response.has_next ??
    page < pages;

  const hasPrev =
    pagination?.has_prev ??
    pagination?.has_previous ??
    response.has_prev ??
    response.has_previous ??
    page > 1;

  return {
    items: Array.isArray(response.items) ? response.items : [],
    pagination: {
      page,
      size,
      total,
      pages,
      has_next: hasNext,
      has_prev: hasPrev,
    },
  };
}
