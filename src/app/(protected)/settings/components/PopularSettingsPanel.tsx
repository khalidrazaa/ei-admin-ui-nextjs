"use client";

import Button from "@/components/ui/Button";
import { PopularScanSettings, YouTubeRegion } from "@/types/types";

const SCAN_CONTROLS = [
  { key: "popular_scan_enabled", label: "Disable popular YouTube scan" },
  { key: "niche_scan_enabled", label: "Disable all niche scans" },
  { key: "youtube_scan_enabled", label: "Disable all YouTube video scans" },
] as const;

type PopularSettingsPanelProps = {
  availableRegions: YouTubeRegion[];
  filteredAvailableRegions: YouTubeRegion[];
  regionSearch: string;
  scanSettings: PopularScanSettings;
  settingsLoading: boolean;
  settingsLoadError: string | null;
  settingsLoaded: boolean;
  settingsSaving: boolean;
  regionsRefreshing: boolean;
  onRetry: () => void;
  onScanControlChange: (key: "youtube_scan_enabled" | "popular_scan_enabled" | "niche_scan_enabled", enabled: boolean) => void;
  onRegionSearchChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onToggleRegion: (regionCode: string) => void;
  onSelectAllRegions: () => void;
  onSave: () => void;
  onRefreshRegions: () => void;
  className?: string;
};

export default function PopularSettingsPanel({
  availableRegions,
  filteredAvailableRegions,
  regionSearch,
  scanSettings,
  settingsLoading,
  settingsLoadError,
  settingsLoaded,
  settingsSaving,
  regionsRefreshing,
  onRetry,
  onScanControlChange,
  onRegionSearchChange,
  onMaxResultsChange,
  onToggleRegion,
  onSelectAllRegions,
  onSave,
  onRefreshRegions,
  className = "",
}: PopularSettingsPanelProps) {
  const disabled = settingsLoading || settingsSaving || !settingsLoaded;
  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="flex gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={onRefreshRegions}
            disabled={disabled || regionsRefreshing}
            className="px-3 py-2 text-sm"
          >
            {regionsRefreshing ? "Fetching..." : "Fetch Regions"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={onSelectAllRegions}
            disabled={disabled || availableRegions.length === 0}
            className="px-3 py-2 text-sm"
          >
            Select All
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={
              disabled ||
              scanSettings.region_codes.length === 0
            }
            className="px-3 py-2 text-sm"
          >
            {settingsSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {settingsLoadError ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{settingsLoadError}</p>
          <Button type="button" onClick={onRetry} disabled={settingsLoading} className="mt-2">
            Reload settings
          </Button>
        </div>
      ) : null}

      <fieldset disabled={disabled} className="mt-4 space-y-3 rounded-lg border border-gray-200 p-4 disabled:opacity-60">
        <legend className="px-1 text-sm font-semibold text-gray-900">YouTube video scanning</legend>
        <p id="youtube-scan-switch-help" className="text-xs text-gray-500">Switch on to disable scanning. Save settings to apply changes. Disabling all YouTube videos overrides the individual switches and keeps their preferences.</p>
        {SCAN_CONTROLS.map(({ key, label }) => {
          const scanDisabled = !scanSettings[key];
          const controlDisabled = disabled || (key !== "youtube_scan_enabled" && !scanSettings.youtube_scan_enabled);
          return (
            <div key={key} className="flex items-center justify-between gap-4 text-sm text-gray-800">
              <span>{label}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span aria-hidden="true" className={`text-xs font-medium ${scanDisabled ? "text-red-700" : "text-gray-500"}`}>{scanDisabled ? "On" : "Off"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-label={label}
                  aria-checked={scanDisabled}
                  aria-describedby="youtube-scan-switch-help"
                  disabled={controlDisabled}
                  onClick={() => onScanControlChange(key, !scanSettings[key])}
                  className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${scanDisabled ? "bg-red-600" : "bg-gray-300"}`}
                >
                  <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${scanDisabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          );
        })}
        {!scanSettings.youtube_scan_enabled ? (
          <p role="status" className="text-xs font-medium text-red-700">All YouTube video scans are disabled. Popular and niche scans stay disabled until the all-video switch is off.</p>
        ) : null}
      </fieldset>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <label htmlFor="popular-scan-max-results" className="mb-2 block text-sm font-medium text-gray-700">
            Results per region
          </label>
          <input
            id="popular-scan-max-results"
            type="number"
            disabled={disabled}
            min="1"
            max="50"
            value={scanSettings.max_results}
            onChange={(e) => onMaxResultsChange(Number(e.target.value))}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="mt-2 text-xs text-gray-500">
            YouTube allows up to 50 results per request.
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-700">Regions</label>
            <input
              type="text"
              value={regionSearch}
              onChange={(e) => onRegionSearchChange(e.target.value)}
              placeholder="Search regions"
              aria-label="Search regions"
              disabled={disabled}
              className="w-full rounded border px-3 py-2 text-sm sm:w-56"
            />
          </div>

          <div className="mb-2 text-xs text-gray-500">
            Selected {scanSettings.region_codes.length} region
            {scanSettings.region_codes.length === 1 ? "" : "s"}
          </div>

          {settingsLoading ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Loading regions from database...
            </div>
          ) : (
            <div className="grid min-h-[24rem] flex-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAvailableRegions.map((region) => {
                const checked = scanSettings.region_codes.includes(region.code);

                return (
                  <label
                    key={region.code}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                      checked
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => onToggleRegion(region.code)}
                    />
                    <span className="min-w-0">
                      {region.name} ({region.code})
                    </span>
                  </label>
                );
              })}

              {filteredAvailableRegions.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  No regions match your search.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
