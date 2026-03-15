import { apiFetch } from "@/lib/api";


export interface Keyword {
  id: number;
  keyword: string;
  is_active: boolean;
}

export interface Niche {
  id: number;
  name: string;
  display_name: string;
  region_code: string;
  scan_mode: string;
  is_active: boolean;
  created_at: string;
  last_scanned_at?: string | null;
  keywords: Keyword[];
}

export async function getNiches(): Promise<Niche[]> {
  const res = await apiFetch<Niche[]>("/admin/niches", {
    method: "GET",
  });

  return res;
}

export async function deleteKeyword(
  nicheId: number,
  keywordId: number
): Promise<void> {
  await apiFetch(`/admin/niches/${nicheId}/keywords/${keywordId}`, {
    method: "DELETE",
  });
}

export async function addKeyword(
  nicheId: number,
  keyword: string
): Promise<Keyword> {
  return apiFetch<Keyword>(
    `/admin/niches/${nicheId}/keywords?keyword=${encodeURIComponent(keyword)}`,
    {
      method: "POST",
    }
  );
}

export async function deleteNiche(nicheId: number) {
  return apiFetch(`/admin/niches/${nicheId}`, {
    method: "DELETE",
  });
}

export async function createNiche(name: string) {
  return apiFetch<Niche>("/admin/niches", {
    method: "POST",
    body: JSON.stringify({
      name,
      display_name: name,
      keywords: [],
    }),
  });
}

export async function updateNicheStatus(nicheId: number, is_active: boolean) {
  return apiFetch(`/admin/niches/${nicheId}`, {
    method: "PUT",
    body: JSON.stringify({
      is_active,
    }),
  });
}