"use client";

type Props = {
  message: string | null;
  type?: "success" | "error" | "info" | null;
  onClose: () => void;
};

export default function Toast({ message, type = "info", onClose }: Props) {
  if (!message) {
    return null;
  }

  const tone =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : type === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-gray-200 bg-white text-gray-800";

  return (
    <div role="status" className="pointer-events-none fixed left-4 right-4 top-20 z-50 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ${tone}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-sm">{message}</div>
          <button
            onClick={onClose}
            className="text-xs font-medium opacity-70 transition hover:opacity-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
