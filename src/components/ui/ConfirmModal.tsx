"use client";

import { useEffect } from "react";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {

  // ESC key support
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }

    if (open) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 flex items-center justify-center z-50 p-4"
    >
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* modal */}
    <div className="relative bg-white rounded-lg shadow-lg w-[360px] max-w-full max-h-[90dvh] overflow-y-auto p-6 animate-modal">
        <h2 className="text-lg font-semibold mb-2">
          {title}
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          {message}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border hover:bg-gray-100"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}