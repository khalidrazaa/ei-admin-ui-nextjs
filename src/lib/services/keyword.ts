import { apiFetch } from "@/lib/api";
import {  KeywordResponse, ScrapeTrendsResponse, Trend } from "@/types/types";


interface TrendsResponse {
  result: Trend[];
}

export async function getKeywords(keyword: string): Promise<KeywordResponse> {
  return apiFetch<KeywordResponse>("/trends/keywords", {
    method: "POST",
    timeoutMs: 0,
    body: JSON.stringify({ keyword }),
  });
}


export async function scrapeTrends(geo: string, hours: string, sts: string): Promise<ScrapeTrendsResponse> {
  return apiFetch(`/trends/scrape?geo=${geo}&hours=${hours}&sts=${sts}`, {
    method: "POST",
    timeoutMs: 0,
  });
}


export async function getTrendsData(): Promise<TrendsResponse> {
  return apiFetch(`/trends/list_trends`, {
    method: "GET",
  }) as Promise<TrendsResponse>; // tell TS the shape
}
