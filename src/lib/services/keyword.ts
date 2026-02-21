import { apiFetch } from "../api";
import {  KeywordResponse, ScrapeTrendsResponse, Trend } from "../../types/types";


interface TrendsResponse {
  result: Trend[];
}

export async function getKeywords(keyword: string): Promise<KeywordResponse> {
  return apiFetch<KeywordResponse>("/admin/trends/keywords", {
    method: "POST",
    body: JSON.stringify({ keyword }),
  });
}


export async function scrapeTrends(geo: string, hours: string, sts: string): Promise<ScrapeTrendsResponse> {
  return apiFetch(`/admin/trends/scrape?geo=${geo}&hours=${hours}&sts=${sts}`, {
    method: "POST",
  });
}


export async function getTrendsData(): Promise<TrendsResponse> {
  return apiFetch(`/admin/trends/list_trends`, {
    method: "GET",
  }) as Promise<TrendsResponse>; // tell TS the shape
}