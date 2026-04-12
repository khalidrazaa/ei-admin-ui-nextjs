export interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  subcategory: string;
  status: "draft" | "published";
  createdAt: string;
  content: string;
}

export interface KeywordResponse {
  keyword: string;
  suggestions: string[];
}

export interface ScrapeTrendsResponse  {
  status: string;
  geo: string;
  hours: string;
  result: {
    processed_rows: number;
    inserted_count: number;
    matched_count: number;
    modified_count: number;
    categorized_count: number;
  };
};

export interface ScrapeYTResponse {
  niche_id: number;
  videos_saved: number;
}

export interface Trend {
  _id: string;
  trend: string;
  category?: string;
  subcategory?: string;
  search_volume?: number;
  is_growing?: boolean;
  status?: string;
  started?: string;
  ended?: string;
  last_updated?: string;
  explore_link?: string;
}

export type TrendVideo = {
  id: number;

  keyword_id: number;
  youtube_video_id: string;

  title: string;
  channel_title: string;

  view_count: number;
  like_count: number | null;
  comment_count: number | null;

  published_at: string;   // ISO string from backend
  scanned_at: string;

  virality_score: number;

  thumbnail_url: string;

  youtube_url: string;    // computed from backend
};

export type PopularVideo = {
  id: number;
  keyword_id: number | null;
  youtube_video_id: string;

  title: string;
  channel_title: string;

  view_count: number;
  like_count: number | null;
  comment_count: number | null;

  published_at: string;
  scanned_at: string;

  virality_score: number;

  thumbnail_url: string;
  source: string;
  region_code: string | null;

  youtube_url: string;
};
