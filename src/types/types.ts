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