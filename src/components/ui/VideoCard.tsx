import { TrendVideo } from "@/types/types";
import {
  formatCompactNumber,
  formatRelativeTime,
} from "@/lib/utils/formatters";

type Props = {
  video: TrendVideo;
};

export default function VideoCard({ video }: Props) {
  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300">
      <img
        src={video.thumbnail_url}
        className="h-24 w-40 rounded-lg object-cover"
        alt={video.title}
      />

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-semibold text-gray-900">
          {video.title}
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {video.channel_title} | {formatRelativeTime(video.published_at)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-gray-100 px-2.5 py-1">
            Views {formatCompactNumber(video.view_count)}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
            Score {video.virality_score.toFixed(1)}
          </span>
        </div>

        <div className="mt-3">
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
