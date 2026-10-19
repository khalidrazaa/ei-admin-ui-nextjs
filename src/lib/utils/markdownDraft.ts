import { JSON_SCHEMA, load } from "js-yaml";

import type { createDraft } from "@/lib/services/articles";
import { parseCsvList } from "./csvList";

export const MAX_MARKDOWN_FILE_BYTES = 2 * 1024 * 1024;

export type MarkdownDraftPayload = Parameters<typeof createDraft>[0] & { status: "draft" };

export type MarkdownDraftImport = {
  payload: MarkdownDraftPayload;
  warnings: string[];
};

const OPTIONAL_STRING_FIELDS = [
  "seo_title",
  "category",
  "subcategory",
  "excerpt",
  "language",
  "meta_description",
  "canonical_url",
  "schema_type",
  "open_graph_title",
  "open_graph_description",
  "open_graph_image",
  "featured_image_url",
  "image_alt_text",
] as const;

const ALLOWED_FIELDS = new Set<string>([
  "title", "slug", "host_site", "tags", "keywords", "is_featured", "reading_time",
  ...OPTIONAL_STRING_FIELDS,
]);

export function validateMarkdownFile(file: { name: string; size: number }): void {
  if (!/\.(md|markdown)$/i.test(file.name)) {
    throw new Error("Choose a Markdown file ending in .md or .markdown.");
  }
  if (file.size > MAX_MARKDOWN_FILE_BYTES) {
    throw new Error("The Markdown file must be 2 MiB or smaller.");
  }
  if (file.size === 0) {
    throw new Error("The Markdown file is empty.");
  }
}

function optionalString(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`Metadata field "${field}" must be text or null.`);
  }
  return value.trim() || null;
}

function stringList(value: unknown, field: string): string[] {
  if (value == null) return [];
  const values = typeof value === "string" ? parseCsvList(value) : value;
  if (!Array.isArray(values) || values.some((item) => typeof item !== "string")) {
    throw new Error(`Metadata field "${field}" must be a list of text values or comma-separated text.`);
  }
  return values.map((item: string) => item.trim()).filter(Boolean);
}

function firstHeading(content: string): string | null {
  let fence: { character: string; length: number } | null = null;
  for (const line of content.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) {
        fence = { character: marker[1][0], length: marker[1].length };
      } else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}#[ \t]+(.+)$/.exec(line);
    const title = heading?.[1].replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (title) return title;
  }
  return null;
}

function titleFromFilename(filename: string): string {
  return (filename.split(/[/\\]/).pop() ?? "")
    .replace(/\.(md|markdown)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "Untitled draft";
}

function slugFromTitle(title: string): string {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function splitFrontMatter(source: string): { metadata: Record<string, unknown>; content: string } {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (!/^---[ \t]*$/.test(lines[0])) return { metadata: {}, content: normalized };

  const closingLine = lines.findIndex((line, index) => index > 0 && /^---[ \t]*$/.test(line));
  if (closingLine === -1) {
    throw new Error("The YAML front matter needs a closing --- line before the article body.");
  }
  const frontMatter = lines.slice(1, closingLine).join("\n");
  let metadata: unknown;
  try {
    metadata = frontMatter.trim() ? load(frontMatter, { schema: JSON_SCHEMA, maxDepth: 20 }) : {};
  } catch {
    throw new Error("The YAML front matter is invalid. Check its indentation, quotes, and duplicate field names.");
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("The YAML front matter must contain metadata fields such as title: My article.");
  }
  return { metadata: metadata as Record<string, unknown>, content: lines.slice(closingLine + 1).join("\n") };
}

export function parseMarkdownDraft(source: string, filename: string): MarkdownDraftImport {
  const { metadata, content } = splitFrontMatter(source);
  if (!content.trim()) {
    throw new Error("The Markdown file needs an article body after the front matter.");
  }
  if (content.includes("\0")) {
    throw new Error("The Markdown file must contain plain text.");
  }

  const title = optionalString(metadata.title, "title") || firstHeading(content) || titleFromFilename(filename);
  const slug = optionalString(metadata.slug, "slug") || slugFromTitle(title);
  if (!slug) {
    throw new Error("A slug could not be generated. Add a slug field to the YAML front matter.");
  }
  const payload: MarkdownDraftPayload = { title, slug, content, status: "draft" };
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (Object.hasOwn(metadata, field)) payload[field] = optionalString(metadata[field], field);
  }
  if (Object.hasOwn(metadata, "host_site")) {
    const hostSite = optionalString(metadata.host_site, "host_site");
    if (hostSite) payload.host_site = hostSite;
  }
  for (const field of ["tags", "keywords"] as const) {
    if (Object.hasOwn(metadata, field)) payload[field] = stringList(metadata[field], field);
  }
  if (Object.hasOwn(metadata, "is_featured")) {
    const value = metadata.is_featured;
    if (typeof value === "boolean") payload.is_featured = value;
    else if (typeof value === "string" && /^(true|false)$/i.test(value.trim())) {
      payload.is_featured = value.trim().toLowerCase() === "true";
    } else {
      throw new Error('Metadata field "is_featured" must be true or false.');
    }
  }
  if (Object.hasOwn(metadata, "reading_time")) {
    const value = metadata.reading_time;
    if (value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) {
      payload.reading_time = value;
    } else {
      throw new Error('Metadata field "reading_time" must be a non-negative whole number of minutes or null.');
    }
  }

  const ignored = Object.keys(metadata).filter((field) => !ALLOWED_FIELDS.has(field));
  return {
    payload,
    warnings: ignored.length ? [`Ignored metadata fields: ${ignored.join(", ")}.`] : [],
  };
}
