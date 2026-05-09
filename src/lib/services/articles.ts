import { apiFetch } from "@/lib/api";
import { Article } from "@/types/types";

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
  payload: Partial<Article>
): Promise<Article> {
  return apiFetch(`/admin/articles/${articleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<Article>;
}
