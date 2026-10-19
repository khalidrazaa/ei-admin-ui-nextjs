import { PopularScanSettings } from "@/types/types";

export function getYouTubeScanDisabledReason(
  settings: PopularScanSettings | null,
  kind: "popular" | "niche",
  loading: boolean,
  error: string | null,
): string | null {
  if (loading) return "Loading YouTube scan settings...";
  if (error || !settings) return error || "YouTube scan settings could not be loaded.";
  if (settings.youtube_scan_enabled !== true) return "All YouTube video scanning is disabled in settings.";
  if (kind === "popular") {
    if (settings.popular_scan_enabled !== true) return "YouTube popular scans are disabled in settings.";
    if (settings.region_codes.length === 0) return "Choose at least one popular scan region in settings.";
  } else if (settings.niche_scan_enabled !== true) {
    return "YouTube niche and keyword scans are disabled in settings.";
  }
  return null;
}
