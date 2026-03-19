
import { apiFetch } from "@/lib/api";
import { TrendVideo } from "@/types/types";


export async function getVideosByKeyword(
  keyword_id: number,
  params: {
    sort?: string;
    min_views?: number;
    days?: number | null;
  } = {}
): Promise<TrendVideo[]> {

  console.log("Fetching videos with params:");
  
  const query = new URLSearchParams();

  if (params.sort) query.append("sort", params.sort);
  if (params.min_views) query.append("min_views", String(params.min_views));
  if (params.days) query.append("days", String(params.days));

  return apiFetch(
    `admin/keywords/${keyword_id}/videos?${query.toString()}`,
    {
      method: "GET",
    }
  ) as Promise<TrendVideo[]>;
}
