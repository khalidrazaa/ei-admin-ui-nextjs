import { apiFetch } from "@/lib/api";
import { Article } from "@/types/types";

export type ArticleDeleteResult = {
  deleted_ids: number[];
  deleted_count: number;
};

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
