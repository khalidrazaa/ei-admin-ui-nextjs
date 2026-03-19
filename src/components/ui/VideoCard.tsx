import { TrendVideo } from "@/types/types";

type Props = {
  video: TrendVideo;
};

export default function VideoCard({ video }: Props) {
  return (
    <div className="flex gap-4 p-3 border rounded-xl">
      
      {/* Thumbnail */}
      <img
        src={video.thumbnail_url}
        className="w-40 h-24 rounded-lg object-cover"
        alt={video.title}
      />

      {/* Content */}
      <div className="flex-1">
        
        {/* Title */}
        <h3 className="font-semibold line-clamp-2">
          {video.title}
        </h3>

        {/* Meta */}
        <p className="text-sm text-gray-500">
          {video.channel_title}
        </p>

        {/* Metrics */}
        <div className="flex gap-4 mt-2 text-sm">
          <span>👁 {video.view_count}</span>
          <span>⚡ {video.virality_score.toFixed(1)}</span>
        </div>

        {/* Actions */}
        <div className="mt-2">
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500"
          >
            Open
          </a>
        </div>

      </div>
    </div>
  );
}