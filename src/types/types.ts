export interface Article {
  id: number;
  title: string;
  slug: string;
  seo_title: string | null;
  category: string | null;
  subcategory: string | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  drafted_at: string | null;
  content: string | null;
  excerpt: string | null;
  reading_time: number | null;
  tags: string[];
  keywords: string[];
  host_site: string;
  language: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  schema_type: string | null;
  open_graph_title: string | null;
  open_graph_description: string | null;
  open_graph_image: string | null;
  featured_image_url: string | null;
  image_alt_text: string | null;
  is_featured: boolean;
}

export interface KeywordResponse {
  keyword: string;
  suggestions: string[];
}

export interface ScrapeTrendsResponse {
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
}

export interface VideoTranscript {
  id: number;
  title: string;
  youtube_video_id: string;
  transcript_text: string;
  transcript_language: string | null;
  transcript_source: string | null;
  transcript_fetched_at: string | null;
}

export type DraftProvider = "gemini" | "chatgpt";

export interface DraftArticleRequest {
  provider: DraftProvider;
  prompt?: string;
  additional_context?: string;
}

export interface ManualTranscriptRequest {
  title: string;
  category_title: string;
  transcript_text: string;
}

export interface DraftPrompt {
  id: number;
  name: string;
  prompt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DraftPromptRequest {
  name: string;
  prompt: string;
  is_active: boolean;
}

export interface YouTubeRegion {
  code: string;
  name: string;
}

export interface PopularScanSettings {
  region_codes: string[];
  max_results: number;
  available_regions?: YouTubeRegion[];
}

export interface PopularScanRunResponse {
  status: string;
  regions: string[];
  max_results: number;
  total_processed: number;
}

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

export type VideoTrendStage =
  | "watchlist"
  | "emerging"
  | "breakout"
  | "trending"
  | "sustained_demand";

export type BaseVideoInsight = {
  id: number;
  keyword_id: number | null;
  youtube_video_id: string;
  youtube_channel_id: string | null;

  title: string;
  description: string | null;
  channel_title: string;
  channel_custom_url: string | null;
  channel_description: string | null;
  channel_country: string | null;

  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  subscriber_count: number | null;
  channel_view_count: number | null;
  channel_video_count: number | null;
  hidden_subscriber_count: boolean | null;

  published_at: string;
  channel_published_at: string | null;
  scanned_at: string;

  virality_score: number;
  speed_score: number | null;
  breakout_score: number | null;
  engagement_score: number | null;
  freshness_score: number | null;
  confidence_score: number | null;
  trend_stage: VideoTrendStage | null;

  thumbnail_url: string;
  channel_thumbnail_url: string | null;
  category_id: string | null;
  category_title: string | null;
  transcript_language_code: string | null;
  transcript_language: string | null;
  transcript_source: string | null;
  transcript_error: string | null;
  transcript_fetched_at: string | null;
  source: string | null;
  region_code: string | null;

  youtube_url: string;
  age_hours: number;
  views_per_hour: number;
  likes_per_1k_views: number;
  comments_per_1k_views: number;
  channel_avg_views: number;
  views_vs_channel_average: number;
  views_vs_subscribers: number | null;
  has_transcript: boolean;
  transcript_excerpt: string | null;
};

export type TrendVideo = BaseVideoInsight;

export type PopularVideo = BaseVideoInsight;
