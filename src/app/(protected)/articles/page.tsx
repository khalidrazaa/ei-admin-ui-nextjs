"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Toast from "@/components/ui/Toast";
import { getArticle, getArticles, updateArticle } from "@/lib/services/articles";
import { getHostSites } from "@/lib/services/host-sites";
import { Article } from "@/types/types";

const DEFAULT_HOST_SITE = "explainit.tech";

type EditorStep = 1 | 2;

type ArticleEditorForm = {
  title: string;
  seo_title: string;
  slug: string;
  status: "draft" | "published";
  category: string;
  subcategory: string;
  tags_csv: string;
  keywords_csv: string;
  host_site: string;
  language: string;
  excerpt: string;
  meta_description: string;
  canonical_url: string;
  schema_type: string;
  open_graph_title: string;
  open_graph_description: string;
  open_graph_image: string;
  featured_image_url: string;
  image_alt_text: string;
  is_featured: boolean;
};

const EMPTY_FORM: ArticleEditorForm = {
  title: "",
  seo_title: "",
  slug: "",
  status: "draft",
  category: "",
  subcategory: "",
  tags_csv: "",
  keywords_csv: "",
  host_site: DEFAULT_HOST_SITE,
  language: "en",
  excerpt: "",
  meta_description: "",
  canonical_url: "",
  schema_type: "Article",
  open_graph_title: "",
  open_graph_description: "",
  open_graph_image: "",
  featured_image_url: "",
  image_alt_text: "",
  is_featured: false,
};

function optionalOrNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

function isLikelyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdownToHtml(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function markdownToEditorHtml(value: string): string {
  const source = value.replace(/\r\n?/g, "\n").trim();
  if (!source) {
    return "<p></p>";
  }

  if (isLikelyHtml(source)) {
    return source;
  }

  const lines = source.split("\n");
  const blocks: string[] = [];
  let index = 0;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }
    blocks.push(`<p>${inlineMarkdownToHtml(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  while (index < lines.length) {
    const rawLine = lines[index].trimEnd();
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const itemMatch = itemLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(`<li>${inlineMarkdownToHtml(itemMatch[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const itemMatch = itemLine.match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(`<li>${inlineMarkdownToHtml(itemMatch[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    paragraphBuffer.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks.length > 0 ? blocks.join("\n") : "<p></p>";
}

function domChildrenToMarkdown(node: ParentNode): string {
  return Array.from(node.childNodes).map(domNodeToMarkdown).join("");
}

function domNodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const childrenText = domChildrenToMarkdown(element).trim();

  if (tagName === "br") return "\n";
  if (tagName === "p") return childrenText ? `${childrenText}\n\n` : "";
  if (tagName === "h1") return childrenText ? `# ${childrenText}\n\n` : "";
  if (tagName === "h2") return childrenText ? `## ${childrenText}\n\n` : "";
  if (tagName === "h3") return childrenText ? `### ${childrenText}\n\n` : "";
  if (tagName === "h4") return childrenText ? `#### ${childrenText}\n\n` : "";
  if (tagName === "h5") return childrenText ? `##### ${childrenText}\n\n` : "";
  if (tagName === "h6") return childrenText ? `###### ${childrenText}\n\n` : "";
  if (tagName === "strong" || tagName === "b") return childrenText ? `**${childrenText}**` : "";
  if (tagName === "em" || tagName === "i") return childrenText ? `*${childrenText}*` : "";
  if (tagName === "code") return childrenText ? `\`${childrenText}\`` : "";

  if (tagName === "a") {
    const href = element.getAttribute("href")?.trim();
    if (!href) return childrenText;
    return `[${childrenText || href}](${href})`;
  }

  if (tagName === "ul") {
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((item) => domChildrenToMarkdown(item).trim())
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");
    return items ? `${items}\n\n` : "";
  }

  if (tagName === "ol") {
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((item) => domChildrenToMarkdown(item).trim())
      .filter(Boolean)
      .map((item, idx) => `${idx + 1}. ${item}`)
      .join("\n");
    return items ? `${items}\n\n` : "";
  }

  if (tagName === "div") {
    const divText = domChildrenToMarkdown(element).trim();
    return divText ? `${divText}\n\n` : "";
  }

  return domChildrenToMarkdown(element);
}

function editorHtmlToMarkdown(html: string): string {
  const normalized = html.trim();
  if (!normalized) return "";

  const container = document.createElement("div");
  container.innerHTML = normalized;

  return domChildrenToMarkdown(container)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getPreviewText(article: Article): string {
  const raw = article.excerpt || article.content || "";
  const withoutHtml = raw.replace(/<[^>]+>/g, " ");
  const normalized = withoutHtml
    .replace(/[#>*_`[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "-";
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function toEditorForm(article: Article): ArticleEditorForm {
  return {
    title: article.title,
    seo_title: article.seo_title ?? "",
    slug: article.slug,
    status: article.status,
    category: article.category ?? "",
    subcategory: article.subcategory ?? "",
    tags_csv: article.tags.join(", "),
    keywords_csv: article.keywords.join(", "),
    host_site: article.host_site || DEFAULT_HOST_SITE,
    language: article.language ?? "en",
    excerpt: article.excerpt ?? "",
    meta_description: article.meta_description ?? "",
    canonical_url: article.canonical_url ?? "",
    schema_type: article.schema_type ?? "Article",
    open_graph_title: article.open_graph_title ?? "",
    open_graph_description: article.open_graph_description ?? "",
    open_graph_image: article.open_graph_image ?? "",
    featured_image_url: article.featured_image_url ?? "",
    image_alt_text: article.image_alt_text ?? "",
    is_featured: article.is_featured,
  };
}

function toUpdatePayload(form: ArticleEditorForm, contentHtml: string): Partial<Article> {
  const markdownContent = editorHtmlToMarkdown(contentHtml);

  return {
    title: form.title.trim(),
    seo_title: optionalOrNull(form.seo_title),
    slug: form.slug.trim(),
    status: form.status,
    category: optionalOrNull(form.category),
    subcategory: optionalOrNull(form.subcategory),
    tags: parseCsv(form.tags_csv),
    keywords: parseCsv(form.keywords_csv),
    host_site: form.host_site.trim() || DEFAULT_HOST_SITE,
    language: form.language.trim() || "en",
    content: markdownContent || null,
    excerpt: optionalOrNull(form.excerpt),
    meta_description: optionalOrNull(form.meta_description),
    canonical_url: optionalOrNull(form.canonical_url),
    schema_type: optionalOrNull(form.schema_type),
    open_graph_title: optionalOrNull(form.open_graph_title),
    open_graph_description: optionalOrNull(form.open_graph_description),
    open_graph_image: optionalOrNull(form.open_graph_image),
    featured_image_url: optionalOrNull(form.featured_image_url),
    image_alt_text: optionalOrNull(form.image_alt_text),
    is_featured: form.is_featured,
  };
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [editorStep, setEditorStep] = useState<EditorStep>(1);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorForm, setEditorForm] = useState<ArticleEditorForm>(EMPTY_FORM);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(
    null
  );
  const [hostSiteOptions, setHostSiteOptions] = useState<string[]>([DEFAULT_HOST_SITE]);
  const contentEditorRef = useRef<HTMLDivElement | null>(null);
  const contentHtmlRef = useRef<string>("");

  const articleSummary = useMemo(() => {
    const drafts = articles.filter((article) => article.status === "draft").length;
    const published = articles.filter((article) => article.status === "published").length;

    return {
      total: articles.length,
      drafts,
      published,
    };
  }, [articles]);

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      const category = article.category?.trim() || "Uncategorized";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === "all") {
      return articles;
    }
    return articles.filter(
      (article) => (article.category?.trim() || "Uncategorized") === selectedCategory
    );
  }, [articles, selectedCategory]);

  const resolvedHostSiteOptions = useMemo(() => {
    const merged = Array.from(new Set([editorForm.host_site.trim(), ...hostSiteOptions])).filter(
      Boolean
    );
    return merged.length > 0 ? merged : [DEFAULT_HOST_SITE];
  }, [editorForm.host_site, hostSiteOptions]);

  useEffect(() => {
    async function loadArticles() {
      try {
        setLoadingList(true);
        const data = await getArticles();
        setArticles(data);
        setError(null);
        const requestedId = Number(new URLSearchParams(window.location.search).get("article"));
        if (requestedId > 0 && Number.isSafeInteger(requestedId)) setSelectedArticleId(requestedId);
      } catch (err) {
        console.error("Failed to load articles", err);
        setError("Failed to load articles");
      } finally {
        setLoadingList(false);
      }
    }

    void loadArticles();
  }, []);

  useEffect(() => {
    async function loadHostSites() {
      try {
        const sites = await getHostSites(true);
        const options = sites.map((site) => site.host).filter(Boolean);
        setHostSiteOptions(options.length > 0 ? Array.from(new Set(options)) : [DEFAULT_HOST_SITE]);
      } catch (err) {
        console.error("Failed to load host sites", err);
        setHostSiteOptions([DEFAULT_HOST_SITE]);
      }
    }

    void loadHostSites();
  }, []);

  useEffect(() => {
    if (selectedArticleId === null) {
      setSelectedArticle(null);
      setEditorForm(EMPTY_FORM);
      contentHtmlRef.current = "";
      if (contentEditorRef.current) {
        contentEditorRef.current.innerHTML = "";
      }
      return;
    }

    const articleId = selectedArticleId;

    async function loadArticle() {
      try {
        setLoadingArticle(true);
        const article = await getArticle(articleId);
        setSelectedArticle(article);
        setEditorForm(toEditorForm(article));
      } catch (err) {
        console.error("Failed to load article", err);
        setMessage(err instanceof Error ? err.message : "Failed to load article");
        setMessageType("error");
      } finally {
        setLoadingArticle(false);
      }
    }

    void loadArticle();
  }, [selectedArticleId]);

  useEffect(() => {
    const editor = contentEditorRef.current;
    if (!editor || !selectedArticle) {
      return;
    }

    const nextHtml = markdownToEditorHtml(selectedArticle.content ?? "");
    contentHtmlRef.current = nextHtml;
    editor.innerHTML = nextHtml;
  }, [selectedArticle]);

  useEffect(() => {
    if (editorStep === 1 && contentEditorRef.current) {
      contentEditorRef.current.innerHTML = contentHtmlRef.current;
    }
  }, [editorStep]);

  useEffect(() => {
    if (!message || messageType === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [message, messageType]);

  function updateFormField<K extends keyof ArticleEditorForm>(field: K, value: ArticleEditorForm[K]) {
    setEditorForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function syncContentFromEditor() {
    const editor = contentEditorRef.current;
    if (!editor) {
      return;
    }
    contentHtmlRef.current = editor.innerHTML;
  }

  function runEditorCommand(command: string, value?: string) {
    const editor = contentEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand(command, false, value);
    contentHtmlRef.current = editor.innerHTML;
  }

  function applyHeading(level: 2 | 3) {
    runEditorCommand("formatBlock", `<h${level}>`);
  }

  function applyParagraph() {
    runEditorCommand("formatBlock", "<p>");
  }

  function handleInsertLink() {
    const rawUrl = window.prompt("Enter link URL (for example, https://example.com)");
    if (!rawUrl) return;

    const trimmed = rawUrl.trim();
    if (!trimmed) return;

    const normalized =
      /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")
        ? trimmed
        : `https://${trimmed}`;

    runEditorCommand("createLink", normalized);
  }

  function openEditor(articleId: number) {
    setSelectedArticleId(articleId);
    setEditorStep(1);
  }

  function closeEditor() {
    setSelectedArticleId(null);
    setEditorStep(1);
  }

  async function handleSave() {
    if (selectedArticleId === null) {
      return;
    }

    if (!editorForm.title.trim()) {
      setMessage("Title is required.");
      setMessageType("error");
      return;
    }

    if (!editorForm.slug.trim()) {
      setMessage("Slug is required.");
      setMessageType("error");
      return;
    }

    if (!editorForm.host_site.trim()) {
      setMessage("Host site is required.");
      setMessageType("error");
      return;
    }

    syncContentFromEditor();

    try {
      setSaving(true);
      setMessage("Saving article updates...");
      setMessageType("info");

      const updated = await updateArticle(
        selectedArticleId,
        toUpdatePayload(editorForm, contentHtmlRef.current)
      );

      setSelectedArticle(updated);
      setEditorForm(toEditorForm(updated));
      setArticles((current) =>
        current.map((article) => (article.id === updated.id ? updated : article))
      );
      setMessage("Article updated successfully.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to update article", err);
      setMessage(err instanceof Error ? err.message : "Failed to update article");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ProtectedPageShell
        title="Articles"
        description="Filter by category, browse in a table, then edit in 2 steps."
        sidebarClassName="w-80"
        settingsHref="/settings?tab=host-sites"
        sidebar={
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Total
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {loadingList ? "..." : articleSummary.total}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Draft
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {loadingList ? "..." : articleSummary.drafts}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Published
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {loadingList ? "..." : articleSummary.published}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Categories
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedCategory === "all"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>All Categories</span>
                  <span className="text-xs">{articles.length}</span>
                </button>

                {categoryStats.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedCategory(item.name)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedCategory === item.name
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-xs">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
        contentClassName="flex-1 overflow-y-auto p-4 lg:p-6"
      >
        {loadingList ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading articles...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : selectedArticleId === null ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Articles</h2>
                <p className="text-xs text-gray-500">
                  {selectedCategory === "all" ? "All Categories" : selectedCategory} |{" "}
                  {filteredArticles.length} article
                  {filteredArticles.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="p-8 text-sm text-gray-500">No articles for this category.</div>
            ) : (
              <>
              <div className="divide-y divide-gray-200 lg:hidden">
                {filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => openEditor(article.id)}
                    className="block w-full space-y-2 p-4 text-left hover:bg-blue-50/50"
                  >
                    <div className="font-medium text-gray-900">{article.title}</div>
                    <div className="text-xs text-gray-500">{article.slug}</div>
                    <div className="text-sm text-gray-700">{getPreviewText(article)}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="capitalize">{article.status}</span>
                      <span>{formatDate(article.created_at)}</span>
                      <span>{article.host_site}</span>
                    </div>
                    <span className="inline-block text-sm font-medium text-blue-700">Edit article</span>
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Article Preview</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Host Site</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredArticles.map((article) => (
                      <tr
                        key={article.id}
                        onClick={() => openEditor(article.id)}
                        className="cursor-pointer align-top hover:bg-blue-50/50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{article.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{article.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{getPreviewText(article)}</td>
                        <td className="px-4 py-3 capitalize text-gray-700">{article.status}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(article.created_at)}</td>
                        <td className="px-4 py-3 text-gray-700">{article.host_site}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        ) : loadingArticle || selectedArticle === null ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading article details...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="sticky top-0 z-20 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:static">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selectedArticle.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Step {editorStep} of 2 | {editorStep === 1 ? "Article Content" : "Metadata"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back To Table
                  </button>
                  {editorStep === 2 ? (
                    <button
                      type="button"
                      onClick={() => setEditorStep(1)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Previous Step
                    </button>
                  ) : null}
                  {editorStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        syncContentFromEditor();
                        setEditorStep(2);
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Next Step
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editorForm.status === "published" ? "Publish Changes" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>

            {editorStep === 1 ? (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 lg:p-6 shadow-sm">
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Title
                  </span>
                  <input
                    value={editorForm.title}
                    onChange={(event) => updateFormField("title", event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Content (rich text)
                  </span>

                  <div className="overflow-hidden rounded-lg border border-gray-300">
                    <div
                      onMouseDown={(event) => event.preventDefault()}
                      className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-2">
                      <button
                        type="button"
                        onClick={() => runEditorCommand("bold")}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => runEditorCommand("italic")}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Italic
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeading(2)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeading(3)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        H3
                      </button>
                      <button
                        type="button"
                        onClick={applyParagraph}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Paragraph
                      </button>
                      <button
                        type="button"
                        onClick={() => runEditorCommand("insertUnorderedList")}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Bullet List
                      </button>
                      <button
                        type="button"
                        onClick={() => runEditorCommand("insertOrderedList")}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Numbered List
                      </button>
                      <button
                        type="button"
                        onClick={handleInsertLink}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => runEditorCommand("removeFormat")}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Clear Format
                      </button>
                    </div>

                    <div
                      ref={contentEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Article content"
                      onInput={syncContentFromEditor}
                      className="min-h-[420px] whitespace-pre-wrap px-3 py-3 text-sm leading-7 text-gray-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 lg:p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      SEO Title
                    </span>
                    <input
                      value={editorForm.seo_title}
                      onChange={(event) => updateFormField("seo_title", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Slug
                    </span>
                    <input
                      value={editorForm.slug}
                      onChange={(event) => updateFormField("slug", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Status
                    </span>
                    <select
                      value={editorForm.status}
                      onChange={(event) =>
                        updateFormField("status", event.target.value as "draft" | "published")
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    >
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Host Site
                    </span>
                    <select
                      value={editorForm.host_site}
                      onChange={(event) => updateFormField("host_site", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    >
                      {resolvedHostSiteOptions.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Category
                    </span>
                    <input
                      value={editorForm.category}
                      onChange={(event) => updateFormField("category", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Subcategory
                    </span>
                    <input
                      value={editorForm.subcategory}
                      onChange={(event) => updateFormField("subcategory", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Language
                    </span>
                    <input
                      value={editorForm.language}
                      onChange={(event) => updateFormField("language", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Schema Type
                    </span>
                    <input
                      value={editorForm.schema_type}
                      onChange={(event) => updateFormField("schema_type", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Tags (comma separated)
                    </span>
                    <input
                      value={editorForm.tags_csv}
                      onChange={(event) => updateFormField("tags_csv", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Keywords (comma separated)
                    </span>
                    <input
                      value={editorForm.keywords_csv}
                      onChange={(event) => updateFormField("keywords_csv", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Excerpt
                    </span>
                    <textarea
                      value={editorForm.excerpt}
                      onChange={(event) => updateFormField("excerpt", event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Meta Description
                    </span>
                    <textarea
                      value={editorForm.meta_description}
                      onChange={(event) => updateFormField("meta_description", event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Canonical URL
                    </span>
                    <input
                      value={editorForm.canonical_url}
                      onChange={(event) => updateFormField("canonical_url", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Open Graph Title
                    </span>
                    <input
                      value={editorForm.open_graph_title}
                      onChange={(event) => updateFormField("open_graph_title", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Open Graph Description
                    </span>
                    <textarea
                      value={editorForm.open_graph_description}
                      onChange={(event) =>
                        updateFormField("open_graph_description", event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Open Graph Image URL
                    </span>
                    <input
                      value={editorForm.open_graph_image}
                      onChange={(event) => updateFormField("open_graph_image", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Featured Image URL
                    </span>
                    <input
                      value={editorForm.featured_image_url}
                      onChange={(event) =>
                        updateFormField("featured_image_url", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Image Alt Text
                    </span>
                    <input
                      value={editorForm.image_alt_text}
                      onChange={(event) => updateFormField("image_alt_text", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editorForm.is_featured}
                    onChange={(event) => updateFormField("is_featured", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Mark as featured article
                </label>
              </div>
            )}
          </div>
        )}
      </ProtectedPageShell>

      <Toast
        message={message}
        type={messageType}
        onClose={() => {
          setMessage(null);
          setMessageType(null);
        }}
      />
    </>
  );
}
