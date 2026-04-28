"use client";

import { useEffect, useMemo, useState } from "react";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Toast from "@/components/ui/Toast";
import {
  generateDraftFromTranscript,
  getDraftTranscript,
  getTranscriptVideos,
} from "@/lib/services/drafts";
import { formatCompactNumber, formatFixedNumber } from "@/lib/utils/formatters";
import {
  Article,
  DraftProvider,
  PopularVideo,
  VideoTranscript,
} from "@/types/types";

const PROVIDER_OPTIONS: Array<{ value: DraftProvider; label: string }> = [
  { value: "gemini", label: "Gemini" },
  { value: "chatgpt", label: "ChatGPT" },
];

export default function DraftPage() {
  const [videos, setVideos] = useState<PopularVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [provider, setProvider] = useState<DraftProvider>("gemini");
  const [prompt, setPrompt] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [latestArticle, setLatestArticle] = useState<Article | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(
    null
  );

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [selectedVideoId, videos]
  );

  useEffect(() => {
    async function loadTranscriptVideos() {
      try {
        setLoading(true);
        const data = await getTranscriptVideos();
        setVideos(data);
        setSelectedVideoId((current) => current ?? data[0]?.id ?? null);
      } catch (err) {
        console.error("Failed to load transcript videos", err);
        setMessage("Failed to load transcript videos");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    }

    void loadTranscriptVideos();
  }, []);

  useEffect(() => {
    if (!selectedVideoId) {
      setTranscript(null);
      return;
    }

    const videoId = selectedVideoId;

    async function loadTranscript() {
      try {
        setTranscriptLoading(true);
        const data = await getDraftTranscript(videoId);
        setTranscript(data);
      } catch (err) {
        console.error("Failed to load transcript", err);
        setMessage(err instanceof Error ? err.message : "Failed to load transcript");
        setMessageType("error");
      } finally {
        setTranscriptLoading(false);
      }
    }

    void loadTranscript();
  }, [selectedVideoId]);

  useEffect(() => {
    if (!message || messageType === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [message, messageType]);

  async function handleGenerateDraft() {
    if (!selectedVideoId) {
      return;
    }

    try {
      setGenerating(true);
      setMessage(`Generating draft with ${provider === "chatgpt" ? "ChatGPT" : "Gemini"}...`);
      setMessageType("info");

      const article = await generateDraftFromTranscript(selectedVideoId, {
        provider,
        prompt: prompt.trim() || undefined,
        additional_context: additionalContext.trim() || undefined,
      });

      setLatestArticle(article);
      setMessage(`Draft saved: ${article.title}`);
      setMessageType("success");
    } catch (err) {
      console.error("Failed to generate draft", err);
      setMessage(err instanceof Error ? err.message : "Failed to generate draft");
      setMessageType("error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ProtectedPageShell
      title="Draft"
      description="Review transcripts and turn them into article drafts."
      sidebar={
        loading ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Loading transcripts...
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            No saved transcripts found yet.
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((video) => {
              const isActive = selectedVideoId === video.id;

              return (
                <button
                  key={video.id}
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="line-clamp-2 text-sm font-medium text-gray-900">
                    {video.title}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {video.trend_stage || "watchlist"}
                    </span>
                    <span>Score {formatFixedNumber(video.virality_score, 1)}</span>
                    <span>{video.category_title || "Uncategorized"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      }
      contentClassName="flex-1 overflow-y-auto p-4"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="flex min-h-[calc(100vh-120px)] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedVideo?.title || "Select a transcript"}
            </h2>
            {selectedVideo ? (
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                <span>{selectedVideo.channel_title}</span>
                <span>{selectedVideo.category_title || "YouTube"}</span>
                <span>{selectedVideo.trend_stage || "watchlist"}</span>
                <span>Score {formatFixedNumber(selectedVideo.virality_score, 1)}</span>
                <span>VPH {formatCompactNumber(selectedVideo.views_per_hour)}</span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {transcriptLoading ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Loading transcript...
              </div>
            ) : transcript ? (
              <div className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-7 text-gray-700">
                {transcript.transcript_text}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Select a transcript to read it here.
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-120px)] flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Draft Settings</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as DraftProvider)}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell the model what kind of draft you want."
                  className="min-h-28 w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Additional Input
                </label>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Audience, tone, SEO targets, structure notes, or anything else to send along."
                  className="min-h-32 w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={() => void handleGenerateDraft()}
                disabled={!selectedVideoId || !transcript || generating}
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "Generating Draft..." : "Create Draft"}
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Latest Saved Draft</h3>
            {latestArticle ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{latestArticle.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{latestArticle.slug}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Status
                    </div>
                    <div className="mt-1 capitalize">{latestArticle.status}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Category
                    </div>
                    <div className="mt-1">{latestArticle.category || "-"}</div>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Excerpt
                  </div>
                  <div>{latestArticle.excerpt || "No excerpt generated."}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Generate a draft and it will show up here after being saved to
                articles.
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast
        message={message}
        type={messageType}
        onClose={() => {
          setMessage(null);
          setMessageType(null);
        }}
      />
    </ProtectedPageShell>
  );
}
