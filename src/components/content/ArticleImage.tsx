import React from "react";

export function safeImageSrc(value: string, allowPreview = false): string | undefined {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  if (/^https?:\/\/[^/]+/i.test(value) || /^\/(?!\/)/.test(value)) return value;
  if (allowPreview && /^blob:https?:\/\//i.test(value)) return value;
  return undefined;
}

export default function ArticleImage({ src, alt, title, standalone = false, preview = false }: {
  src: string; alt: string; title?: string; standalone?: boolean; preview?: boolean;
}) {
  const safe = safeImageSrc(src, preview);
  if (!safe) return <span>{alt || "Image unavailable"}</span>;
  const image = <img src={safe} alt={alt} title={title} loading="lazy" decoding="async" className="h-auto max-w-full rounded border border-gray-200 bg-white" />;
  if (!standalone) return image;
  return <figure className="my-6 space-y-2">{image}{title && <figcaption className="text-sm text-gray-600">{title}</figcaption>}</figure>;
}
