"use client";

import { useEffect } from "react";
import Button from "./Button";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {

  // ESC key support
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    }

    if (open) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onCancel, loading]);

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={title} aria-busy={loading} className="fixed inset-0 flex items-center justify-center z-50 p-4"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      {/* modal */}
    <div className="relative bg-white rounded-lg shadow-lg w-[360px] max-w-full max-h-[90dvh] overflow-y-auto p-6 animate-modal">
        <h2 className="text-lg font-semibold mb-2">
          {title}
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          {message}
        </p>

        {errorMessage && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelText}
          </button>

          <Button
            variant="danger"
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded bg-red-600 !px-3 !py-1.5 !text-sm !text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
