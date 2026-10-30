import { findMarkdownImages } from "./markdownImages";

export const MAX_ARTICLE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ARTICLE_IMAGES = 10;
export const MAX_ARTICLE_UPLOAD_BYTES = 50 * 1024 * 1024;

export type NamedArticleFile = { name: string; size: number; webkitRelativePath?: string };

export function validateImageFiles<T extends NamedArticleFile>(files: T[], markdownBytes = 0): void {
  if (files.length > MAX_ARTICLE_IMAGES) throw new Error("Choose up to 10 SVG or PNG diagrams per upload.");
  const names = new Set<string>();
  for (const file of files) {
    if (!/\.(svg|png)$/i.test(file.name)) throw new Error("Choose a Markdown (.md or .markdown), SVG, or PNG file.");
    if (names.has(file.name)) throw new Error(`Two selected files are named "${file.name}". Rename one before uploading.`);
    names.add(file.name);
    if (!file.size) throw new Error(`The image "${file.name}" is empty.`);
    if (file.size > MAX_ARTICLE_IMAGE_BYTES) throw new Error(`The image "${file.name}" must be 5 MiB or smaller.`);
  }
  if (files.reduce((total, file) => total + file.size, markdownBytes) > MAX_ARTICLE_UPLOAD_BYTES) {
    throw new Error("The article files must total 50 MiB or less.");
  }
}

function normalizedPath(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Match the original if URL encoding is malformed. */ }
  return decoded.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isLocalImageDestination(value: string): boolean {
  return !/^https?:\/\//i.test(value) && !/^\/(?!\/)/.test(value);
}

function diagramStem(value: string): string | null {
  return /\.(svg|png)$/i.test(value) ? value.replace(/\.(svg|png)$/i, "") : null;
}

export function getArticleImageMappings(
  content: string,
  files: NamedArticleFile[],
  selected: Record<string, string> = {},
) {
  const references = [...new Set(findMarkdownImages(content).map((image) => image.destination))];
  const manifest: Record<string, string> = Object.create(null);
  const missing: string[] = [];
  for (const destination of references) {
    const explicit = selected[destination];
    if (explicit && files.some((file) => file.name === explicit)) {
      manifest[destination] = explicit;
      continue;
    }
    if (!isLocalImageDestination(destination)) continue;
    const path = normalizedPath(destination);
    const basename = path.slice(path.lastIndexOf("/") + 1);
    const tiers = [
      files.filter((file) => normalizedPath(file.webkitRelativePath || file.name) === path),
      files.filter((file) => normalizedPath(file.name) === basename),
    ];
    const pathStem = diagramStem(path);
    if (pathStem !== null) {
      // The diagram's name identifies it even if Markdown was exported as PNG
      // and the selected diagram was exported as SVG, or the other way around.
      tiers.push(files.filter((file) => diagramStem(normalizedPath(file.webkitRelativePath || file.name)) === pathStem));
      const basenameStem = diagramStem(basename);
      tiers.push(files.filter((file) => diagramStem(normalizedPath(file.name)) === basenameStem));
    }
    // An ambiguous stronger match must be resolved explicitly, never guessed.
    const matches = tiers.find((candidates) => candidates.length > 0) ?? [];
    if (matches.length === 1) manifest[destination] = matches[0].name;
    else missing.push(destination);
  }
  return {
    references,
    manifest,
    missing,
    unused: files.filter((file) => !Object.values(manifest).includes(file.name)).map((file) => file.name),
  };
}

/** The backend checks the same request ID against the complete batch fingerprint. */
export function articleImportFingerprint(article: unknown, files: NamedArticleFile[], manifest: Record<string, string>): string {
  return JSON.stringify([article, files.map((file) => [file.name, file.size, "lastModified" in file ? file.lastModified : null]), manifest]);
}

export function imageMarkdown(filename: string): string {
  const label = filename.replace(/\.(svg|png)$/i, "").replace(/[-_]+/g, " ").replace(/[\\[\]]/g, "");
  return `![${label}](<${filename.replace(/>/g, "%3E").replace(/</g, "%3C")}>)`;
}
