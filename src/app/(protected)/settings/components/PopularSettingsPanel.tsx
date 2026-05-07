"use client";

import Button from "@/components/ui/Button";
import { PopularScanSettings, YouTubeRegion } from "@/types/types";

type PopularSettingsPanelProps = {
  availableRegions: YouTubeRegion[];
  filteredAvailableRegions: YouTubeRegion[];
  regionSearch: string;
  scanSettings: PopularScanSettings;
  settingsLoading: boolean;
  settingsSaving: boolean;
  regionsRefreshing: boolean;
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
  settingsSaving,
  regionsRefreshing,
  onRegionSearchChange,
  onMaxResultsChange,
  onToggleRegion,
  onSelectAllRegions,
  onSave,
  onRefreshRegions,
  className = "",
}: PopularSettingsPanelProps) {
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
            disabled={settingsLoading || regionsRefreshing}
            className="px-3 py-2 text-sm"
          >
            {regionsRefreshing ? "Fetching..." : "Fetch Regions"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={onSelectAllRegions}
            disabled={settingsLoading || availableRegions.length === 0}
            className="px-3 py-2 text-sm"
          >
            Select All
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={
              settingsLoading ||
              settingsSaving ||
              scanSettings.region_codes.length === 0
            }
            className="px-3 py-2 text-sm"
          >
            {settingsSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Results per region
          </label>
          <input
            type="number"
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
