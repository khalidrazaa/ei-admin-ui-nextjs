import { apiFetch } from "@/lib/api";
import { Article, DraftArticleRequest, PopularVideo, VideoTranscript } from "@/types/types";

export async function getTranscriptVideos(): Promise<PopularVideo[]> {
  return apiFetch("/admin/youtube-scan/transcripts/videos", {
    method: "GET",
  }) as Promise<PopularVideo[]>;
}

export async function getDraftTranscript(videoId: number): Promise<VideoTranscript> {
  return apiFetch(`/admin/youtube-scan/videos/${videoId}/transcript`, {
    method: "GET",
  }) as Promise<VideoTranscript>;
}

export async function generateDraftFromTranscript(
  videoId: number,
  payload: DraftArticleRequest
): Promise<Article> {
  return apiFetch(`/admin/youtube-scan/videos/${videoId}/draft-article`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<Article>;
}
