"use client";

import type { ChangeEvent, RefObject } from "react";

import Button from "@/components/ui/Button";

type ArticleFileUploadProps = {
  inputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
  reading?: boolean;
  allowMarkdown?: boolean;
  markdownFilename?: string;
  images: File[];
  previewUrls: Record<string, string>;
  references: string[];
  manifest: Record<string, string>;
  missing: string[];
  unused: string[];
  error?: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (filename: string) => void;
  onMapping: (destination: string, filename: string) => void;
  onInsert: (filename: string) => void;
};

/** One file picker/drop area is shared by new imports and existing article edits. */
export default function ArticleFileUpload({
  inputRef, disabled, reading, allowMarkdown = true, markdownFilename, images, previewUrls,
  references, manifest, missing, unused, error, onFiles, onRemove, onMapping, onInsert,
}: ArticleFileUploadProps) {
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!disabled && files.length) onFiles(files);
  }

  return <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
    <div
      className="rounded-lg border-2 border-dashed border-gray-300 p-4"
      onDragOver={(event) => { event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); if (!disabled) onFiles(Array.from(event.dataTransfer.files)); }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {reading ? "Reading article files..." : "Upload article files"}
        </Button>
        {allowMarkdown && <a href="/examples/draft-template.md" download className="text-sm text-blue-700 underline">Download template</a>}
      </div>
      <input ref={inputRef} type="file" multiple hidden disabled={disabled}
        accept={allowMarkdown ? ".md,.markdown,.svg,.png,text/markdown,image/svg+xml,image/png" : ".svg,.png,image/svg+xml,image/png"}
        aria-label="Upload article files" onChange={choose} />
      <p className="mt-2 text-sm text-gray-600">{allowMarkdown ? "Drop one Markdown file and its SVG/PNG diagrams here, or choose them together." : "Drop SVG/PNG diagrams here to add or replace images in this article."} Review the preview, then save everything together.</p>
      <p className="mt-1 text-xs text-gray-500">Markdown: 2 MiB. Each diagram: 5 MiB. Up to 10 diagrams and 50 MiB total.</p>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {markdownFilename && <p className="text-sm text-gray-700">Markdown: {markdownFilename}</p>}
    {images.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">
      {images.map((file) => <li key={file.name} className="rounded-lg border border-gray-200 p-3">
        {/* Blob previews stay in image context; SVG markup is never inserted into the page. */}
        {previewUrls[file.name] && <img src={previewUrls[file.name]} alt={`Preview of ${file.name}`} className="mb-2 max-h-40 max-w-full object-contain" />}
        <p className="break-all text-sm font-medium">{file.name}</p>
        <p className="text-xs text-gray-500">{Math.ceil(file.size / 1024)} KiB · {unused.includes(file.name) ? "Not inserted yet" : "Matched to article"}</p>
        <div className="mt-2 flex gap-3 text-sm">
          <button type="button" disabled={disabled} className="text-blue-700 underline" onClick={() => onInsert(file.name)}>Insert image</button>
          <button type="button" disabled={disabled} className="text-red-700 underline" onClick={() => onRemove(file.name)} aria-label={`Remove ${file.name}`}>Remove</button>
        </div>
      </li>)}
    </ul>}
    {references.length > 0 && <div className="space-y-2">
      <p className="text-sm font-medium">Article image references</p>
      <p className="text-xs text-gray-500">SVG and PNG files with the same diagram name match automatically. For a different name or multiple matches, choose the file below.</p>
      {references.map((destination) => <label key={destination} className="grid gap-1 text-sm sm:grid-cols-2 sm:items-center">
        <span className="break-all">{destination}{missing.includes(destination) && <span className="ml-2 text-red-700">Missing file</span>}</span>
        <select disabled={disabled} aria-label={`Image file for ${destination}`} className="rounded border border-gray-300 px-2 py-1"
          value={manifest[destination] || ""} onChange={(event) => onMapping(destination, event.target.value)}>
          <option value="">{missing.includes(destination) ? "Choose matching file" : "Keep existing URL"}</option>
          {images.map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}
        </select>
      </label>)}
      {missing.length > 0 && <p className="text-sm text-amber-800">Add or match every missing diagram before saving this import.</p>}
    </div>}
  </div>;
}
