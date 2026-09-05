"use client";
import { useEffect, useState } from "react";
import Button from "./Button";
import Toast from "./Toast";
import TranscriptModal from "./TranscriptModal";
import { generateDraftArticle, getVideoTranscript, saveVideoTranscript } from "@/lib/services/videos";
import { PopularVideo, VideoTranscript } from "@/types/types";
export default function VideoTranscriptAction({video, onVideoUpdated}: {
 video: PopularVideo; onVideoUpdated: (video: PopularVideo) => void;
}) {
 const [message, setMessage] = useState<string | null>(null);
 const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(null);
  const [transcriptReadLoadingId, setTranscriptReadLoadingId] = useState<number | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const [draftLoadingId, setDraftLoadingId] = useState<number | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<VideoTranscript | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

 useEffect(() => {
  if (!message) return;
  const timeout = window.setTimeout(() => { setMessage(null); setMessageType(null); }, 4500);
  return () => window.clearTimeout(timeout);
 }, [message]);
  async function handleOpenTranscript(video: PopularVideo) {
    setActiveTranscript({
      id: video.id,
      title: video.title,
      youtube_video_id: video.youtube_video_id,
      transcript_text: "",
      transcript_language: video.transcript_language,
      transcript_source: video.transcript_source,
      transcript_fetched_at: video.transcript_fetched_at,
    });
    setTranscriptOpen(true);

    if (!video.has_transcript) {
      setTranscriptLoading(false);
      return;
    }

    try {
      setTranscriptReadLoadingId(video.id);
      setTranscriptLoading(true);
      setMessage("Loading transcript...");
      setMessageType("info");

      const transcript = await getVideoTranscript(video.id);
      setActiveTranscript(transcript);
      setMessage(null);
      setMessageType(null);
    } catch (err) {
      console.error("Failed to load transcript", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to load transcript"
      );
      setMessageType("error");
    } finally {
      setTranscriptLoading(false);
      setTranscriptReadLoadingId(null);
    }
  }

  async function handleSaveTranscript(transcriptText: string) {
    if (!activeTranscript) {
      return;
    }

    try {
      setTranscriptSaving(true);
      setMessage("Saving transcript...");
      setMessageType("info");

      const updatedVideo = await saveVideoTranscript(activeTranscript.id, transcriptText);
      onVideoUpdated(updatedVideo);
      setActiveTranscript((current) =>
        current
          ? {
              ...current,
              transcript_text: transcriptText.trim(),
              transcript_language: updatedVideo.transcript_language,
              transcript_source: updatedVideo.transcript_source,
              transcript_fetched_at: updatedVideo.transcript_fetched_at,
            }
          : current
      );
      setMessage("Transcript saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save transcript", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to save transcript"
      );
      setMessageType("error");
    } finally {
      setTranscriptSaving(false);
    }
  }

  async function handleGenerateDraft(videoId: number) {
    try {
      setDraftLoadingId(videoId);
      setMessage("Sending transcript to Gemini and saving a draft article...");
      setMessageType("info");

      const article = await generateDraftArticle(videoId);
      setMessage(`Draft article saved: ${article.title}`);
      setMessageType("success");
    } catch (err) {
      console.error("Failed to generate draft article", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to generate draft article"
      );
      setMessageType("error");
    } finally {
      setDraftLoadingId(null);
    }
  }

 return (<>
  <Button variant="secondary" onClick={() => void handleOpenTranscript(video)} disabled={transcriptReadLoadingId === video.id} className="text-sm">
   {transcriptReadLoadingId === video.id ? "Opening..." : "Transcript"}
  </Button>
        <TranscriptModal
          open={transcriptOpen}
          transcript={activeTranscript}
          loadingTranscript={transcriptLoading}
          savingTranscript={transcriptSaving}
          creatingDraft={draftLoadingId === activeTranscript?.id}
          onSaveTranscript={(transcriptText) => {
            void handleSaveTranscript(transcriptText);
          }}
          onCreateDraft={() => {
            if (activeTranscript) {
              void handleGenerateDraft(activeTranscript.id);
            }
          }}
          onClose={() => {
            if (transcriptLoading || transcriptSaving || draftLoadingId !== null) return;
            setTranscriptOpen(false);
            setActiveTranscript(null);
          }}
        />

  <Toast message={message} type={messageType} onClose={() => { setMessage(null); setMessageType(null); }} />
 </>);
}
