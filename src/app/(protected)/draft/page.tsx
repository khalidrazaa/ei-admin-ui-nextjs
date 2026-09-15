"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Toast from "@/components/ui/Toast";
import {
  createManualTranscript,
  generateDraftFromTranscript,
  getDraftTranscript,
  getTranscriptVideos,
} from "@/lib/services/drafts";
import { getDraftPrompts } from "@/lib/services/draft-prompts";
import { formatCompactNumber, formatFixedNumber } from "@/lib/utils/formatters";
import {
  Article,
  DraftPrompt,
  DraftProvider,
  PopularVideo,
  VideoTranscript,
} from "@/types/types";

const PROVIDER_OPTIONS: Array<{ value: DraftProvider; label: string }> = [
  { value: "gemini", label: "Gemini" },
  { value: "chatgpt", label: "ChatGPT" },
];

type TranscriptMode = "existing" | "manual";

const DEFAULT_ADDITIONAL_INPUT = `Return a complete Article JSON object with article content and metadata.

Required article fields:
- title: strong article headline
- seo_title: search-optimized title
- content: full article in markdown
- excerpt: short article summary
- meta_description: SEO meta description under 160 characters
- category: main category
- subcategory: optional subcategory
- tags: array of short tag strings
- keywords: array of SEO keyword strings
- host_site: use explainit.tech unless another host is clearly requested
- status: draft
- language: ISO language code, usually en
- canonical_url: source URL or clean article URL candidate
- schema_type: usually Article
- open_graph_title: social title
- open_graph_description: social summary under 200 characters
- open_graph_image: image URL if available, otherwise null
- featured_image_url: image URL if available, otherwise null
- image_alt_text: descriptive alt text for the image
- is_featured: boolean

Do not invent unsupported facts. If a metadata value is unknown, use null or a sensible default.`;

export default function DraftPage() {
  const [videos, setVideos] = useState<PopularVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<TranscriptMode>("existing");
  const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualTranscript, setManualTranscript] = useState("");
  const [savingManualTranscript, setSavingManualTranscript] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<DraftPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | "custom">("custom");
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [provider, setProvider] = useState<DraftProvider>("gemini");
  const [prompt, setPrompt] = useState("");
  const [additionalContext, setAdditionalContext] = useState(DEFAULT_ADDITIONAL_INPUT);
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

  const groupedVideos = useMemo(() => {
    const groups = new Map<string, PopularVideo[]>();

    videos.forEach((video) => {
      const category = video.category_title || "Uncategorized";
      groups.set(category, [...(groups.get(category) ?? []), video]);
    });

    return Array.from(groups.entries()).sort(([categoryA], [categoryB]) =>
      categoryA.localeCompare(categoryB)
    );
  }, [videos]);

  const loadTranscriptVideos = useCallback(async (preferredVideoId?: number) => {
    try {
      setLoading(true);
      const data = await getTranscriptVideos();
      setVideos(data);
      const nextVideo =
        data.find((video) => video.id === preferredVideoId) ?? data[0] ?? null;

      if (nextVideo) {
        setSelectedCategory(nextVideo.category_title || "Uncategorized");
      }

      setSelectedVideoId((current) => {
        if (preferredVideoId) {
          return preferredVideoId;
        }
        return current ?? data[0]?.id ?? null;
      });
    } catch (err) {
      console.error("Failed to load transcript videos", err);
      setMessage("Failed to load transcript videos");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTranscriptVideos();
  }, [loadTranscriptVideos]);

  useEffect(() => {
    async function loadPrompts() {
      try {
        setPromptsLoading(true);
        const data = await getDraftPrompts(true);
        setSavedPrompts(data);
      } catch (err) {
        console.error("Failed to load draft prompts", err);
        setMessage("Failed to load draft prompts");
        setMessageType("error");
      } finally {
        setPromptsLoading(false);
      }
    }

    void loadPrompts();
  }, []);

  useEffect(() => {
    if (!selectedVideo) {
      return;
    }

    const category = selectedVideo.category_title || "Uncategorized";
    setSelectedCategory(category);
    setExpandedCategories((current) => new Set(current).add(category));
  }, [selectedVideo]);

  useEffect(() => {
    if (mode !== "existing" || !selectedVideoId) {
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
  }, [mode, selectedVideoId]);

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
    if (mode !== "existing" || !selectedVideoId) {
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

  async function handleCreateManualTranscript() {
    const title = manualTitle.trim();
    const category = manualCategory.trim();
    const transcriptText = manualTranscript.trim();

    if (!title || !category || !transcriptText) {
      setMessage("Title, category, and transcript are required.");
      setMessageType("error");
      return;
    }

    try {
      setSavingManualTranscript(true);
      setMessage("Saving manual transcript...");
      setMessageType("info");

      const video = await createManualTranscript({
        title,
        category_title: category,
        transcript_text: transcriptText,
      });

      setManualTitle("");
      setManualCategory("");
      setManualTranscript("");
      setMode("existing");
      setSelectedVideoId(video.id);
      await loadTranscriptVideos(video.id);
      setMessage("Manual transcript saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save manual transcript", err);
      setMessage(err instanceof Error ? err.message : "Failed to save transcript");
      setMessageType("error");
    } finally {
      setSavingManualTranscript(false);
    }
  }

  return (
    <ProtectedPageShell
      title="Draft"
      description="Review transcripts and turn them into article drafts."
      settingsHref="/settings?tab=prompts"
      sidebar={
        <div className="space-y-4">
          <button
            onClick={() => {
              setMode("manual");
              setSelectedVideoId(null);
              setTranscript(null);
              setManualCategory(selectedCategory ?? "");
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
              mode === "manual"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            New Transcript
          </button>

          {loading ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Loading transcripts...
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No saved transcripts found yet.
            </div>
          ) : (
            <div className="space-y-2">
              {groupedVideos.map(([category, categoryVideos], index) => {
                const expanded = expandedCategories.has(category);
                const categoryId = "draft-category-" + index;

                return (
                  <div key={category} className="overflow-hidden rounded-lg border border-gray-200">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={categoryId}
                      onClick={() => {
                        setExpandedCategories((current) => {
                          const next = new Set(current);
                          if (next.has(category)) next.delete(category);
                          else next.add(category);
                          return next;
                        });
                      }}
                      className="flex w-full items-center gap-2 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={"h-4 w-4 shrink-0 transition-transform " + (expanded ? "rotate-90" : "")}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{category}</span>
                      <span className="shrink-0 text-xs text-gray-500">{categoryVideos.length}</span>
                    </button>
                    <div id={categoryId} hidden={!expanded} className="space-y-1 border-t border-gray-200 p-2">
                      {categoryVideos.map((video) => {
                        const isActive = mode === "existing" && selectedVideoId === video.id;

                        return (
                          <button
                            key={video.id}
                            type="button"
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => {
                              setMode("existing");
                              setSelectedVideoId(video.id);
                            }}
                            className={"w-full rounded-lg border p-3 text-left transition " + (
                              isActive
                                ? "border-blue-400 bg-blue-50"
                                : "border-transparent bg-white hover:bg-gray-50"
                            )}
                          >
                            <div className="line-clamp-2 text-sm font-medium text-gray-900">{video.title}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5">
                                {video.source === "MANUAL" ? "manual" : video.trend_stage || "watchlist"}
                              </span>
                              {video.source !== "MANUAL" ? (
                                <span>Score {formatFixedNumber(video.virality_score, 1)}</span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      }
      contentClassName="min-w-0 flex-1 overflow-y-auto p-4"
    >
        <div className="flex min-h-[calc(100vh-120px)] min-w-0 flex-col gap-4">
          <div className="flex lg:min-h-[560px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === "manual"
                ? "New Transcript"
                : selectedVideo?.title || "Select a transcript"}
            </h2>
            {mode === "existing" && selectedVideo ? (
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                <span>{selectedVideo.channel_title}</span>
                <span>{selectedVideo.category_title || "YouTube"}</span>
                <span>
                  {selectedVideo.source === "MANUAL"
                    ? "manual"
                    : selectedVideo.trend_stage || "watchlist"}
                </span>
                {selectedVideo.source !== "MANUAL" ? (
                  <>
                    <span>Score {formatFixedNumber(selectedVideo.virality_score, 1)}</span>
                    <span>VPH {formatCompactNumber(selectedVideo.views_per_hour)}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {mode === "manual" ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Title or Heading
                  </label>
                  <input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Add the title for this transcript"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    placeholder="Technology, AI, Business..."
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Transcript
                  </label>
                  <textarea
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    placeholder="Paste or write the transcript here."
                    className="min-h-[50dvh] lg:min-h-[420px] w-full rounded border px-3 py-2 text-sm leading-7"
                  />
                </div>

                <button
                  onClick={() => void handleCreateManualTranscript()}
                  disabled={savingManualTranscript}
                  className="w-full lg:w-auto rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingManualTranscript ? "Saving..." : "Save Transcript"}
                </button>
              </div>
            ) : transcriptLoading ? (
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
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
                  Saved Prompt
                </label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "custom") {
                      setSelectedPromptId("custom");
                      return;
                    }

                    const promptId = Number(value);
                    const selectedPrompt =
                      savedPrompts.find((item) => item.id === promptId) ?? null;
                    setSelectedPromptId(promptId);
                    setPrompt(selectedPrompt?.prompt ?? "");
                  }}
                  disabled={promptsLoading}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="custom">
                    {promptsLoading ? "Loading prompts..." : "Custom prompt"}
                  </option>
                  {savedPrompts.map((savedPrompt) => (
                    <option key={savedPrompt.id} value={savedPrompt.id}>
                      {savedPrompt.name}
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
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setSelectedPromptId("custom");
                  }}
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
                  placeholder="Describe article and metadata requirements for the model."
                  className="min-h-80 w-full rounded border px-3 py-2 text-sm leading-6"
                />
              </div>

              <button
                onClick={() => void handleGenerateDraft()}
                disabled={mode !== "existing" || !selectedVideoId || !transcript || generating}
                className="w-full lg:w-auto rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "Generating Draft..." : "Create Draft"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Latest Saved Draft</h3>
            {latestArticle ? (
              <div className="mt-4 space-y-3">
                <Link href={"/articles?article=" + latestArticle.id} className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Review & Publish</Link>
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
