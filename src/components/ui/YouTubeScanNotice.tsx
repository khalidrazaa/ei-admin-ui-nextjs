import Link from "next/link";

export default function YouTubeScanNotice({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p role="status" className="text-sm text-gray-600">
      {reason}{" "}
      <Link href="/settings?tab=youtube-popular" className="font-medium text-blue-700 underline">
        YouTube scan settings
      </Link>
    </p>
  );
}
