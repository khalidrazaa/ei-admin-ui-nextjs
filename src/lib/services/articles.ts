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
