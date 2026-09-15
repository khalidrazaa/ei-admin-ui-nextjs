import { apiFetch } from "@/lib/api";
import {
  Article,
  DraftArticleRequest,
  ManualTranscriptRequest,
  PopularVideo,
  VideoTranscript,
} from "@/types/types";

export async function getTranscriptVideos(): Promise<PopularVideo[]> {
  return apiFetch("/admin/videos/transcripts/videos", {
    method: "GET",
  }) as Promise<PopularVideo[]>;
}

export async function getDraftTranscript(videoId: number): Promise<VideoTranscript> {
  return apiFetch(`/admin/videos/transcript/${videoId}`, {
    method: "GET",
  }) as Promise<VideoTranscript>;
}

export async function createManualTranscript(
  payload: ManualTranscriptRequest
): Promise<PopularVideo> {
  return apiFetch("/admin/videos/transcripts/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<PopularVideo>;
}

export async function generateDraftFromTranscript(
  videoId: number,
  payload: DraftArticleRequest
): Promise<Article> {
  return apiFetch(`/admin/articles/draft-article/${videoId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<Article>;
}
