"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import ArticleEvidence from "@/components/content/ArticleEvidence";
import ArticleMarkdown from "@/components/content/ArticleMarkdown";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Table, { type TableColumn } from "@/components/ui/Table";
import Toast from "@/components/ui/Toast";
import { VideoPaginationControls } from "@/components/ui/VideoFilters";
import {
  createDraft,
  deleteArticle,
  deleteArticles,
  getArticle,
  getArticleCategories,
  getArticlePage,
  type ArticlePage,
  updateArticle,
} from "@/lib/services/articles";
import { getHostSites } from "@/lib/services/host-sites";
import { formatCsvList, parseCsvList } from "@/lib/utils/csvList";
import { parseMarkdownDraft, validateMarkdownFile } from "@/lib/utils/markdownDraft";
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
  reading_time: string;
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
  reading_time: "",
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

function slugFromTitle(title: string): string {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

function toEditorForm(article: Pick<Article, "title" | "slug"> & Partial<Article>): ArticleEditorForm {
  return {
    title: article.title,
    seo_title: article.seo_title ?? "",
    slug: article.slug,
    status: article.status ?? "draft",
    category: article.category ?? "",
    subcategory: article.subcategory ?? "",
    tags_csv: formatCsvList(article.tags ?? []),
    keywords_csv: formatCsvList(article.keywords ?? []),
    host_site: article.host_site || DEFAULT_HOST_SITE,
    language: article.language ?? "en",
    excerpt: article.excerpt ?? "",
    reading_time: article.reading_time == null ? "" : String(article.reading_time),
    meta_description: article.meta_description ?? "",
    canonical_url: article.canonical_url ?? "",
    schema_type: article.schema_type ?? "Article",
    open_graph_title: article.open_graph_title ?? "",
    open_graph_description: article.open_graph_description ?? "",
    open_graph_image: article.open_graph_image ?? "",
    featured_image_url: article.featured_image_url ?? "",
    image_alt_text: article.image_alt_text ?? "",
    is_featured: article.is_featured ?? false,
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
    tags: parseCsvList(form.tags_csv),
    keywords: parseCsvList(form.keywords_csv),
    host_site: form.host_site.trim() || DEFAULT_HOST_SITE,
    language: form.language.trim() || "en",
    content: markdownContent || null,
    excerpt: optionalOrNull(form.excerpt),
    ...(form.reading_time.trim() ? { reading_time: Number(form.reading_time) } : {}),
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

type ArticleManagerProps = {
  status?: "draft" | "published";
  sidebarExtra?: ReactNode;
  onRefresh?: () => void;
};

export default function ArticleManager({ status = "published", sidebarExtra, onRefresh }: ArticleManagerProps = {}) {
  const isDraft = status === "draft";
  const [sourceMode, setSourceMode] = useState(false);
  const [markdownSource, setMarkdownSource] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlePage, setArticlePage] = useState<ArticlePage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loadingList, setLoadingList] = useState(true);
  const [listReloadVersion, setListReloadVersion] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = useState<string | null>(null);
  const [categoryOptionsReloadVersion, setCategoryOptionsReloadVersion] = useState(0);
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    articleIds: number[];
    message: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [newDraft, setNewDraft] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ filename: string; warnings: string[] } | null>(null);
  const [editorStep, setEditorStep] = useState<EditorStep>(1);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [articleLoadError, setArticleLoadError] = useState<string | null>(null);
  const [articleReloadVersion, setArticleReloadVersion] = useState(0);
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
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const deletionInProgressRef = useRef(false);
  const initialSelectionRead = useRef(false);
  const savingRef = useRef(false);
  const createdArticleIdRef = useRef<number | null>(null);
  const slugEditedRef = useRef(false);
  const markdownFileInputRef = useRef<HTMLInputElement | null>(null);
  const importingRef = useRef(false);
  const deletionControlsDisabled = deleting || deleteTarget !== null || importing || loadingList || search.trim() !== debouncedSearch;
  const editorControlsDisabled = saving || importing;

  const categoryStats = articlePage?.categories ?? [];
  const resolvedCategoryOptions = useMemo(() =>
    Array.from(new Set([
      ...categoryOptions,
      ...categoryStats.filter((category) => category.name !== "Uncategorized").map((category) => category.name),
    ].map((category) => category.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
  [categoryOptions, categoryStats]);
  const isCustomCategory = customCategoryMode ||
    (Boolean(editorForm.category.trim()) && !resolvedCategoryOptions.includes(editorForm.category.trim()));

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      setLoadingCategories(true);
      setCategoryOptionsError(null);
      try {
        const categories = await getArticleCategories();
        if (!cancelled) setCategoryOptions(categories);
      } catch (error) {
        if (!cancelled) setCategoryOptionsError(error instanceof Error ? error.message : "Unable to load categories.");
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }
    void loadCategories();
    return () => { cancelled = true; };
  }, [listReloadVersion, categoryOptionsReloadVersion]);

  useEffect(() => {
    if (search.trim() === debouncedSearch) return;
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, debouncedSearch]);

  useEffect(() => {
    if (
      !loadingList &&
      selectedCategory !== "all" &&
      !categoryStats.some((item) => item.name === selectedCategory)
    ) {
      setSelectedCategory("all");
      setPage(1);
      setSelectedArticleIds(new Set());
    }
  }, [categoryStats, selectedCategory, loadingList]);

  const filteredArticles = articles;

  const selectedVisibleIds = filteredArticles
    .filter((article) => selectedArticleIds.has(article.id))
    .map((article) => article.id);
  const selectedCount = selectedVisibleIds.length;
  const allArticlesSelected = filteredArticles.length > 0 && selectedCount === filteredArticles.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allArticlesSelected;
    }
  }, [selectedCount, allArticlesSelected, selectedArticleId, loadingList]);

  const resolvedHostSiteOptions = useMemo(() => {
    const merged = Array.from(new Set([editorForm.host_site.trim(), ...hostSiteOptions])).filter(
      Boolean
    );
    return merged.length > 0 ? merged : [DEFAULT_HOST_SITE];
  }, [editorForm.host_site, hostSiteOptions]);

  useEffect(() => {
    let cancelled = false;
    async function loadArticles() {
      try {
        setLoadingList(true);
        setError(null);
        const data = await getArticlePage({ status, page, size: pageSize,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          search: debouncedSearch });
        if (cancelled) return;
        setArticlePage(data);
        if (page > Math.max(1, data.total_pages)) {
          setPage(Math.max(1, data.total_pages));
          setSelectedArticleIds(new Set());
          return;
        }
        setArticles(data.items.filter((article) => article.status === status));
        setError(null);
        if (!initialSelectionRead.current) {
          initialSelectionRead.current = true;
          const requestedId = Number(new URLSearchParams(window.location.search).get("article"));
          if (requestedId > 0 && Number.isSafeInteger(requestedId)) setSelectedArticleId(requestedId);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load articles", err);
        setError(err instanceof Error ? err.message : "Failed to load articles.");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }

    void loadArticles();
    return () => { cancelled = true; };
  }, [listReloadVersion, status, page, pageSize, selectedCategory, debouncedSearch]);

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
      setArticleLoadError(null);
      setEditorForm(EMPTY_FORM);
      contentHtmlRef.current = "";
      if (contentEditorRef.current) {
        contentEditorRef.current.innerHTML = "";
      }
      return;
    }

    const articleId = selectedArticleId;
    if (createdArticleIdRef.current === articleId) {
      createdArticleIdRef.current = null;
      return;
    }
    let cancelled = false;

    async function loadArticle() {
      try {
        setLoadingArticle(true);
        setArticleLoadError(null);
        setSelectedArticle(null);
        const article = await getArticle(articleId);
        if (cancelled) return;
        setSelectedArticle(article);
        setMarkdownSource(article.content ?? "");
        // Stored Markdown may include syntax the rich text editor cannot round-trip.
        setSourceMode(true);
        setEditorForm(toEditorForm(article));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load article", err);
        setArticleLoadError(err instanceof Error ? err.message : "Failed to load article.");
      } finally {
        if (!cancelled) setLoadingArticle(false);
      }
    }

    void loadArticle();
    return () => { cancelled = true; };
  }, [selectedArticleId, articleReloadVersion]);

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
    if (savingRef.current || importingRef.current) return;
    if (newDraft && field === "slug") slugEditedRef.current = true;
    setEditorForm((current) => ({
      ...current,
      [field]: value,
      ...(newDraft && field === "title" && !slugEditedRef.current ? { slug: slugFromTitle(String(value)) } : {}),
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
    if (savingRef.current || importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    setImportError(null);
    setImportFeedback(null);
    setNewDraft(false);
    setCustomCategoryMode(false);
    setSelectedArticleId(articleId);
    setEditorStep(1);
  }

  function startNewDraft() {
    if (!isDraft || savingRef.current || importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setNewDraft(true);
    setCustomCategoryMode(false);
    setEditorForm({ ...EMPTY_FORM });
    setEditorStep(1);
    setArticleLoadError(null);
    setLoadingArticle(false);
    setSourceMode(false);
    setMarkdownSource("");
    setMessage(null);
    setMessageType(null);
    setImportError(null);
    setImportFeedback(null);
    slugEditedRef.current = false;
    contentHtmlRef.current = "";
    if (contentEditorRef.current) contentEditorRef.current.innerHTML = "";
  }

  function closeEditor() {
    if (importingRef.current || (newDraft && savingRef.current)) return;
    setImportError(null);
    setImportFeedback(null);
    setNewDraft(false);
    setCustomCategoryMode(false);
    setSelectedArticleId(null);
    setEditorStep(1);
  }

  async function handleMarkdownUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !isDraft || selectedArticleId !== null || savingRef.current || importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    importingRef.current = true;
    setImporting(true);
    setImportError(null);
    try {
      validateMarkdownFile(file);
      const bytes = await file.arrayBuffer();
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error("The Markdown file must use UTF-8 encoding. Save it as UTF-8 and try again.");
      }
      const { payload, warnings } = parseMarkdownDraft(source, file.name);
      setNewDraft(true);
      setCustomCategoryMode(false);
      setEditorForm(toEditorForm(payload));
      setEditorStep(1);
      setArticleLoadError(null);
      setSourceMode(true);
      setMarkdownSource(payload.content);
      setMessage(null);
      setMessageType(null);
      slugEditedRef.current = true;
      contentHtmlRef.current = "";
      if (contentEditorRef.current) contentEditorRef.current.innerHTML = "";
      setImportFeedback({ filename: file.name, warnings });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unable to read this Markdown file. Try again.");
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  function selectCategory(category: string) {
    if (importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    setSelectedCategory(category);
    setPage(1);
    setSelectedArticleIds(new Set());
  }

  function toggleArticleSelection(articleId: number) {
    if (importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  }

  function toggleAllArticles() {
    if (importingRef.current || deletionInProgressRef.current || deleteTarget) return;
    setSelectedArticleIds(
      allArticlesSelected ? new Set() : new Set(filteredArticles.map((article) => article.id))
    );
  }

  function requestDelete(articleIds: number[]) {
    if (importingRef.current || deletionInProgressRef.current || deleteTarget || articleIds.length === 0) return;

    const article = articles.find((item) => item.id === articleIds[0]) ??
      (selectedArticle?.id === articleIds[0] ? selectedArticle : null);
    const target = articleIds.length === 1
      ? `"${article?.title ?? "this article"}"`
      : `${articleIds.length} selected articles`;
    setDeleteError(null);
    setDeleteTarget({
      articleIds: [...articleIds],
      message: `Permanently delete ${target} and any associated comments? This cannot be undone.`,
    });
  }

  function cancelDelete() {
    if (deletionInProgressRef.current) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleDeleteConfirmed() {
    if (deletionInProgressRef.current || !deleteTarget) return;
    const articleIds = deleteTarget.articleIds;

    deletionInProgressRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = articleIds.length === 1
        ? await deleteArticle(articleIds[0])
        : await deleteArticles(articleIds);
      const deletedIds = new Set(result.deleted_ids);
      setArticles((current) => current.filter((item) => !deletedIds.has(item.id)));
      setSelectedArticleIds((current) =>
        new Set([...current].filter((id) => !deletedIds.has(id)))
      );
      setMessage(`${result.deleted_count} article${result.deleted_count === 1 ? "" : "s"} deleted successfully.`);
      setMessageType("success");
      setDeleteTarget(null);
      setListReloadVersion((version) => version + 1);
    } catch (err) {
      console.error("Failed to delete articles", err);
      const failureMessage = err instanceof Error ? err.message : "Failed to delete articles.";
      setDeleteError(failureMessage);
      setMessage(failureMessage);
      setMessageType("error");
    } finally {
      deletionInProgressRef.current = false;
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (savingRef.current || importingRef.current || (selectedArticleId === null && !newDraft)) {
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

    if (editorForm.reading_time.trim() && (!Number.isSafeInteger(Number(editorForm.reading_time)) || Number(editorForm.reading_time) < 0)) {
      setMessage("Reading time must be a whole number of minutes, 0 or greater.");
      setMessageType("error");
      return;
    }

    syncContentFromEditor();

    savingRef.current = true;
    try {
      setSaving(true);
      setMessage(newDraft ? "Saving draft..." : "Saving article updates...");
      setMessageType("info");

      const payload = { ...toUpdatePayload(editorForm, sourceMode ? "" : contentHtmlRef.current), ...(sourceMode ? { content: markdownSource } : {}) };
      const updated = newDraft
        ? await createDraft({ ...payload, title: editorForm.title.trim(), slug: editorForm.slug.trim(), content: payload.content ?? "", status: "draft" })
        : await updateArticle(selectedArticleId!, { ...payload, expected_updated_at: selectedArticle?.updated_at ?? null });

      setSelectedArticle(updated);
      setEditorForm(toEditorForm(updated));
      setCustomCategoryMode(false);
      const savedCategory = updated.category?.trim();
      if (savedCategory) setCategoryOptions((current) => Array.from(new Set([...current, savedCategory])));
      if (newDraft) {
        createdArticleIdRef.current = updated.id;
        setSelectedArticleId(updated.id);
        setNewDraft(false);
        setSelectedCategory("all");
        setSearch("");
        setDebouncedSearch("");
        setPage(1);
        setListReloadVersion((version) => version + 1);
        setSelectedArticleIds(new Set());
        setMessage("Draft created successfully.");
        setMessageType("success");
        return;
      }
      setArticles((current) =>
        updated.status === status
          ? current.map((article) => (article.id === updated.id ? updated : article))
          : current.filter((article) => article.id !== updated.id)
      );
      if (updated.status !== status) {
        setSelectedArticleIds((current) => {
          const next = new Set(current);
          next.delete(updated.id);
          return next;
        });
      }
      setListReloadVersion((current) => current + 1);
      setMessage("Article updated successfully.");
      setMessageType("success");
    } catch (err) {
      console.error(newDraft ? "Failed to create draft" : "Failed to update article", err);
      setMessage(err instanceof Error ? err.message : newDraft ? "Failed to create draft." : "Failed to update article");
      setMessageType("error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const articleColumns: TableColumn<Article>[] = [
    {
      id: "selection",
      header: (
        <input
          ref={selectAllRef}
          type="checkbox"
          aria-label="Select all articles on this page"
          checked={allArticlesSelected}
          onChange={toggleAllArticles}
          disabled={deletionControlsDisabled}
          className="mx-auto block h-4 w-4 rounded border-gray-300 accent-blue-600"
        />
      ),
      align: "center",
      headerClassName: "w-12",
      stopRowClick: true,
      render: (article) => (
        <input
          type="checkbox"
          aria-label={`Select ${article.title}`}
          checked={selectedArticleIds.has(article.id)}
          onChange={() => toggleArticleSelection(article.id)}
          disabled={deletionControlsDisabled}
          className="mx-auto block h-4 w-4 rounded border-gray-300 accent-blue-600"
        />
      ),
    },
    {
      id: "title",
      header: "Title",
      accessor: "title",
      headerClassName: "!font-bold",
      className: "text-gray-900",
    },
    {
      id: "category",
      header: "Category",
      render: (article) => article.category?.trim() || "Uncategorized",
      className: "text-gray-700",
    },
    {
      id: "status",
      header: "Status",
      accessor: "status",
      className: "capitalize text-gray-700",
    },
    {
      id: "created_at",
      header: "Date",
      render: (article) => formatDate(article.created_at),
      className: "text-gray-700",
    },
    {
      id: "host_site",
      header: "Host Site",
      accessor: "host_site",
      className: "text-gray-700",
    },
    {
      id: "actions",
      header: "Actions",
      align: "center",
      stopRowClick: true,
      render: (article) => (
        <Button
          variant="danger"
          type="button"
          aria-label={`Delete ${article.title}`}
          onClick={() => requestDelete([article.id])}
          disabled={deletionControlsDisabled}
          className="inline-flex items-center justify-center rounded-lg border border-red-200 !py-0.5 !text-sm !leading-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </Button>
      ),
    },
  ];

  const markdownUploadControls = <div className="flex flex-wrap items-center gap-3">
    <Button type="button" onClick={() => markdownFileInputRef.current?.click()} disabled={editorControlsDisabled || deletionControlsDisabled}>
      {importing ? "Reading Markdown..." : "Upload Markdown"}
    </Button>
    <a href="/examples/draft-template.md" download className="text-sm text-blue-700 underline">Download template</a>
  </div>;

  return (
    <>
      {isDraft && <input
        ref={markdownFileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/x-markdown"
        aria-label="Upload Markdown draft"
        hidden
        disabled={editorControlsDisabled || deletionControlsDisabled}
        onChange={(event) => void handleMarkdownUpload(event)}
      />}
      <ProtectedPageShell
        title={isDraft ? "Drafts" : "Articles"}
        description={isDraft ? "Review drafted articles before publishing" : undefined}
        sidebarClassName="w-80"
        settingsHref="/settings?tab=host-sites"
        sidebar={
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Categories
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => selectCategory("all")}
                  disabled={deletionControlsDisabled}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedCategory === "all"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>All Categories</span>
                  <span className="text-xs">{articlePage?.category_total ?? 0}</span>
                </button>

                {categoryStats.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => selectCategory(item.name)}
                    disabled={deletionControlsDisabled}
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
            {sidebarExtra}
          </div>
        }
        contentClassName="flex-1 overflow-y-auto p-4 lg:p-6"
      >
        {importError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{importError}</div>}
        {importing && <p role="status" className="mb-4 text-sm text-gray-500">Reading Markdown file...</p>}
        {loadingList && !articlePage ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            {isDraft ? "Loading drafted articles..." : "Loading articles..."}
          </div>
        ) : error ? (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setListReloadVersion((version) => version + 1)}
              className="rounded-lg border border-red-300 bg-white px-3 py-2 font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : selectedArticleId === null && !newDraft ? (
          <div aria-busy={loadingList} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                {isDraft && <Button type="button" onClick={startNewDraft} disabled={deletionControlsDisabled}>New draft</Button>}
                {isDraft && markdownUploadControls}
                <p className="text-xs text-gray-500">
                  {selectedCategory === "all" ? "All Categories" : selectedCategory} |{" "}
                  {articlePage?.total ?? 0} article
                  {articlePage?.total === 1 ? "" : "s"}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {isDraft && <Button
                  type="button"
                  onClick={() => {
                    setListReloadVersion((version) => version + 1);
                    onRefresh?.();
                  }}
                  disabled={deletionControlsDisabled}
                >Refresh</Button>}
                <span aria-live="polite" className="text-xs text-gray-500">{selectedCount} selected</span>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => requestDelete(selectedVisibleIds)}
                  disabled={deletionControlsDisabled || selectedCount === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 !px-3 !py-1.5 !text-sm !text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete selected"}
                </Button>
              </div>
            </div>

            <div className="border-b border-gray-200 p-4">
              <input
                aria-label={isDraft ? "Search drafted articles" : "Search published articles"}
                disabled={deleting || deleteTarget !== null || importing}
                placeholder="Search title, slug or category"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedArticleIds(new Set());
                }}
              />
            </div>
            {loadingList && <p role="status" className="px-4 py-2 text-sm text-gray-500">Loading articles...</p>}

            {filteredArticles.length === 0 ? (
              <div className="p-8 text-sm text-gray-500">{isDraft
                ? search ? "No matching drafted articles." : articlePage?.category_total === 0
                  ? "No saved drafts yet. Choose New draft, upload Markdown, or generate an article from Topics."
                  : "No drafted articles for this category."
                : "No published articles for this category."}</div>
            ) : (
              <>
              <div className="divide-y divide-gray-200 lg:hidden">
                {filteredArticles.map((article) => (
                  <div key={article.id} className="flex gap-3 p-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${article.title}`}
                      checked={selectedArticleIds.has(article.id)}
                      onChange={() => toggleArticleSelection(article.id)}
                      disabled={deletionControlsDisabled}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => openEditor(article.id)}
                        disabled={deletionControlsDisabled}
                        className="block w-full space-y-2 text-left hover:bg-blue-50/50"
                      >
                        <div className="font-medium text-gray-900">{article.title}</div>
                        <div className="text-xs text-gray-500">{article.slug}</div>
                        <div className="text-sm text-gray-700">{getPreviewText(article)}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>{article.category?.trim() || "Uncategorized"}</span>
                          <span className="capitalize">{article.status}</span>
                          <span>{formatDate(article.created_at)}</span>
                          <span>{article.host_site}</span>
                        </div>
                        <span className="inline-block text-sm font-medium text-blue-700">Edit article</span>
                      </button>
                      <Button
                        variant="danger"
                        type="button"
                        aria-label={`Delete ${article.title}`}
                        onClick={() => requestDelete([article.id])}
                        disabled={deletionControlsDisabled}
                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-red-200 !text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Table
                data={filteredArticles}
                columns={articleColumns}
                getRowKey={(article) => article.id}
                ariaLabel={isDraft ? "Drafted articles" : "Published articles"}
                onRowClick={(article) => openEditor(article.id)}
                isRowDisabled={() => deletionControlsDisabled}
                rowClassName={(article) => `hover:bg-blue-50/50 ${selectedArticleIds.has(article.id) ? "bg-blue-50" : ""}`}
                className="hidden lg:block"
              />
              </>
            )}
            {articlePage && <div className="px-4">
              <VideoPaginationControls
                itemLabel="articles"
                pagination={{ page: articlePage.page, size: articlePage.size, total: articlePage.total,
                  pages: Math.max(1, articlePage.total_pages), has_next: articlePage.has_next,
                  has_prev: articlePage.has_previous }}
                pageSize={pageSize}
                disabled={deletionControlsDisabled}
                onPageChange={(nextPage) => { setPage(nextPage); setSelectedArticleIds(new Set()); }}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); setSelectedArticleIds(new Set()); }}
              />
            </div>}
          </div>
        ) : articleLoadError ? (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            <p>{articleLoadError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArticleReloadVersion((version) => version + 1)}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 font-medium hover:bg-red-100"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 font-medium hover:bg-red-100"
              >
                Back To Table
              </button>
            </div>
          </div>
        ) : !newDraft && (loadingArticle || selectedArticle === null) ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading article details...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="sticky top-0 z-20 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:static">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{newDraft ? "New draft" : selectedArticle?.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Step {editorStep} of 2 | {editorStep === 1 ? "Article Content" : "Metadata"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={importing || (saving && newDraft)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back To Table
                  </button>
                  {editorStep === 2 ? (
                    <button
                      type="button"
                      onClick={() => { if (!savingRef.current && !importingRef.current) setEditorStep(1); }}
                      disabled={editorControlsDisabled}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Previous Step
                    </button>
                  ) : null}
                  {editorStep === 1 ? (
                    <button
                      type="button"
                      disabled={editorControlsDisabled}
                      onClick={() => {
                        if (savingRef.current || importingRef.current) return;
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
                    disabled={editorControlsDisabled}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : newDraft ? "Save Draft" : editorForm.status === "published" ? "Publish Changes" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>

            {selectedArticle && <ArticleEvidence articleId={selectedArticle.id} content={selectedArticle.content ?? ""} />}
            {newDraft && <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              {markdownUploadControls}
              <p className="text-sm text-gray-500">Write your article or upload a UTF-8 .md or .markdown file (up to 2 MiB). YAML front matter fills the metadata. Review both steps, then choose Save Draft.</p>
              {importFeedback && <div role="status" className="space-y-2 text-sm text-gray-700">
                <p>Loaded {importFeedback.filename}. Review the article and metadata, then save your draft.</p>
                {importFeedback.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-800">{importFeedback.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
              </div>}
            </div>}
            <fieldset disabled={editorControlsDisabled} className="min-w-0">
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
                    <label className="flex gap-2 p-3"><input type="checkbox" checked={sourceMode} onChange={(e) => {
                      if (e.target.checked) setMarkdownSource(editorHtmlToMarkdown(contentHtmlRef.current));
                      else { contentHtmlRef.current = markdownToEditorHtml(markdownSource); if(contentEditorRef.current) contentEditorRef.current.innerHTML = contentHtmlRef.current; }
                      setSourceMode(e.target.checked);
                    }} />Edit Markdown (preserves diagrams and tables)</label>
                    {sourceMode && <div className="p-3"><textarea aria-label="Article Markdown" className="min-h-[420px] w-full rounded border p-3 font-mono text-sm" value={markdownSource} onChange={e=>setMarkdownSource(e.target.value)} /><details><summary>Reader preview</summary><ArticleMarkdown content={markdownSource} /></details></div>}
                    <div style={{display: sourceMode ? "none" : undefined}}
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
                      style={{display: sourceMode ? "none" : undefined}}
                      contentEditable={!editorControlsDisabled}
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
                      disabled={newDraft}
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

                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Category
                      </span>
                      <select
                        value={isCustomCategory ? "custom" : editorForm.category.trim() ? `existing:${editorForm.category.trim()}` : "none"}
                        onChange={(event) => {
                          if (savingRef.current || importingRef.current) return;
                          const value = event.target.value;
                          setCustomCategoryMode(value === "custom");
                          updateFormField("category", value.startsWith("existing:") ? value.slice("existing:".length) : "");
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                      >
                        <option value="none">Uncategorized</option>
                        {resolvedCategoryOptions.map((category) => (
                          <option key={category} value={`existing:${category}`}>{category}</option>
                        ))}
                        <option value="custom">Custom category…</option>
                      </select>
                    </label>
                    {isCustomCategory && <label className="block space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Custom category</span>
                      <input
                        value={editorForm.category}
                        onChange={(event) => {
                          if (savingRef.current || importingRef.current) return;
                          setCustomCategoryMode(true);
                          updateFormField("category", event.target.value);
                        }}
                        placeholder="Enter a category"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                      />
                    </label>}
                    {loadingCategories && <p role="status" className="text-xs text-gray-500">Loading categories…</p>}
                    {categoryOptionsError && <div className="space-y-1 text-xs text-amber-800">
                      <p role="alert">{categoryOptionsError} You can still enter a custom category.</p>
                      <button type="button" onClick={() => setCategoryOptionsReloadVersion((version) => version + 1)} className="underline">Retry categories</button>
                    </div>}
                  </div>

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
                    <textarea
                      value={editorForm.tags_csv}
                      rows={2}
                      onChange={(event) => updateFormField("tags_csv", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Keywords (comma separated)
                    </span>
                    <textarea
                      value={editorForm.keywords_csv}
                      rows={2}
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
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Reading Time (minutes)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Estimate automatically"
                      value={editorForm.reading_time}
                      onChange={(event) => updateFormField("reading_time", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                    <span className="block text-xs text-gray-500">Leave blank to estimate from the article when saved.</span>
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
            </fieldset>
          </div>
        )}
      </ProtectedPageShell>

      {deleteTarget && (
        <ConfirmModal
          open={true}
          title={deleteTarget.articleIds.length === 1 ? "Delete article" : "Delete articles"}
          message={deleteTarget.message}
          confirmText={deleting
            ? "Deleting..."
            : deleteTarget.articleIds.length === 1
              ? "Delete article"
              : `Delete ${deleteTarget.articleIds.length} articles`}
          loading={deleting}
          errorMessage={deleteError}
          onConfirm={() => void handleDeleteConfirmed()}
          onCancel={cancelDelete}
        />
      )}

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
