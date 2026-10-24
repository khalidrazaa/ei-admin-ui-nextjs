import { apiFetch } from "@/lib/api";
import { Article } from "@/types/types";

export type ArticleDeleteResult = {
  deleted_ids: number[];
  deleted_count: number;
};

export type ArticleListParams = {
  status?: "draft" | "published";
  page?: number;
  size?: number;
  category?: string;
  search?: string;
};

export type ArticlePage = {
  items: Article[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  categories: Array<{ name: string; count: number }>;
  category_total: number;
};

export async function getArticlePage(params: ArticleListParams = {}): Promise<ArticlePage> {
  const query = new URLSearchParams({ page: String(params.page ?? 1), size: String(params.size ?? 20) });
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("category", params.category);
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiFetch<ArticlePage>(`/admin/articles?${query}`, { method: "GET" });
}

export async function getArticleCategories(): Promise<string[]> {
  return apiFetch<string[]>("/admin/articles/categories", { method: "GET" });
}

type DraftCreatePayload = Pick<Article, "title" | "slug"> &
  Partial<Omit<Article, "id" | "created_at" | "updated_at" | "published_at" | "drafted_at" | "status" | "content">> & {
    content: string;
    status?: "draft";
  };

export async function createDraft(payload: DraftCreatePayload): Promise<Article> {
  return apiFetch<Article>("/admin/articles", {
    method: "POST",
    body: JSON.stringify({ ...payload, status: "draft" }),
  });
}

export async function getArticles(status?: "draft" | "published"): Promise<Article[]> {
  const query = new URLSearchParams();
  if (status) {
    query.append("status", status);
  }

  return apiFetch(`/admin/articles${query.toString() ? `?${query.toString()}` : ""}`, {
    method: "GET",
  }) as Promise<Article[]>;
}

export async function getArticle(articleId: number): Promise<Article> {
  return apiFetch(`/admin/articles/${articleId}`, {
    method: "GET",
  }) as Promise<Article>;
}

export async function updateArticle(
  articleId: number,
  payload: Partial<Article> & { expected_updated_at?: string | null }
): Promise<Article> {
  return apiFetch(`/admin/articles/${articleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<Article>;
}

export async function deleteArticle(articleId: number): Promise<ArticleDeleteResult> {
  return apiFetch<ArticleDeleteResult>(`/admin/articles/${articleId}`, {
    method: "DELETE",
  });
}

export async function deleteArticles(articleIds: number[]): Promise<ArticleDeleteResult> {
  return apiFetch<ArticleDeleteResult>("/admin/articles/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ article_ids: articleIds }),
  });
}
