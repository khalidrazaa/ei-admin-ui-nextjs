"use client";

import { useEffect } from "react";

import { VideoTranscript } from "@/types/types";

type Props = {
  open: boolean;
  transcript: VideoTranscript | null;
  creatingDraft?: boolean;
  onCreateDraft: () => void;
  onClose: () => void;
};

export default function TranscriptModal({
  open,
  transcript,
  creatingDraft = false,
  onCreateDraft,
  onClose,
}: Props) {
  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open || !transcript) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{transcript.title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {transcript.transcript_language
              ? `Transcript ${transcript.transcript_language}`
              : "Transcript"}
            {transcript.transcript_source ? ` | ${transcript.transcript_source}` : ""}
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-700">
            {transcript.transcript_text}
          </pre>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onCreateDraft}
            disabled={creatingDraft}
            className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingDraft ? "Creating Draft..." : "Create Draft"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
