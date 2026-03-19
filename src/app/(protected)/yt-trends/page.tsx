'use client';

import { useEffect, useState } from "react";
import VideoCard from "@/components/ui/VideoCard";
import { getVideosByKeyword } from "@/lib/services/yt-trends";
import { TrendVideo } from "@/types/types";

export default function TrendsPage() {
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [keywordId, setKeywordId] = useState<number>(1); // temp
  const [sort, setSort] = useState<string>("score");
  const [minViews, setMinViews] = useState<number>(0);
  const [days, setDays] = useState<number | null>(null);

  const fetchVideos = async () => {
    const data = await getVideosByKeyword(keywordId, {
      sort,
      min_views: minViews,
      days,
    });
    console.log("Fetched videos:", data);
    setVideos(data);
  };

  useEffect(() => {
    fetchVideos();
  }, [keywordId, sort, minViews, days]);

  return (
    <div className="p-4">

      {/* 🔽 Controls */}
      <div className="flex gap-4 mb-4">

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="score">Score</option>
          <option value="views">Views</option>
          <option value="recent">Recent</option>
        </select>

        <input
          type="number"
          placeholder="Min Views"
          onChange={(e) => setMinViews(Number(e.target.value))}
        />

        <select
          onChange={(e) =>
            setDays(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>

      </div>

      {/* 🔽 Video List */}
      <div className="flex flex-col gap-4">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

    </div>
  );
}