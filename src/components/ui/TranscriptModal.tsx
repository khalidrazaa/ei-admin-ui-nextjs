"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { VideoTranscript } from "@/types/types";

type Props = {
  open: boolean;
  transcript: VideoTranscript | null;
  loadingTranscript?: boolean;
  savingTranscript?: boolean;
  creatingDraft?: boolean;
  onSaveTranscript: (transcriptText: string) => void;
  onCreateDraft: () => void;
  onClose: () => void;
};

function normalizeTranscriptText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export default function TranscriptModal({
  open,
  transcript,
  loadingTranscript = false,
  savingTranscript = false,
  creatingDraft = false,
  onSaveTranscript,
  onCreateDraft,
  onClose,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [draftText, setDraftText] = useState("");

  const savedText = useMemo(
    () => normalizeTranscriptText(transcript?.transcript_text ?? ""),
    [transcript?.transcript_text]
  );
  const hasDraftText = draftText.trim().length > 0;
  const isDirty = draftText !== savedText;

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextText = normalizeTranscriptText(transcript?.transcript_text ?? "");
    setDraftText(nextText);

    if (editorRef.current && editorRef.current.innerText !== nextText) {
      editorRef.current.innerText = nextText;
    }
  }, [open, transcript?.id, transcript?.transcript_text]);

  if (!open || !transcript) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{transcript.title}</h2>

        </div>

        <div className="overflow-y-auto px-6 py-5">


          {loadingTranscript ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Loading saved transcript...
            </div>
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              onInput={(event) => {
                setDraftText(
                  normalizeTranscriptText(event.currentTarget.innerText || "")
                );
              }}
              className="min-h-[420px] whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          )}

          {!loadingTranscript && !hasDraftText ? (
            <div className="mt-3 text-xs text-gray-400">
              No transcript saved yet.
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => onSaveTranscript(draftText)}
            disabled={loadingTranscript || savingTranscript || !hasDraftText || !isDirty}
            className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingTranscript ? "Saving..." : "Save Transcript"}
          </button>
          <button
            onClick={onCreateDraft}
            disabled={loadingTranscript || creatingDraft || !savedText || isDirty}
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
