"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Toast from "@/components/ui/Toast";
import {
  getPopularScanRegions,
  getPopularScanSettings,
  updatePopularScanSettings,
} from "@/lib/services/popular-videos";
import { PopularScanSettings, YouTubeRegion } from "@/types/types";

import PopularSettingsPanel from "./components/PopularSettingsPanel";

const DEFAULT_SCAN_SETTINGS: PopularScanSettings = {
  region_codes: ["US"],
  max_results: 10,
};

const SETTINGS_TABS = [
  { key: "youtube-popular", label: "Youtube Popular" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

function resolveTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.key === value)
    ? (value as SettingsTab)
    : "youtube-popular";
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(
    null
  );
  const [scanSettings, setScanSettings] =
    useState<PopularScanSettings>(DEFAULT_SCAN_SETTINGS);
  const [availableRegions, setAvailableRegions] = useState<YouTubeRegion[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");

  const filteredAvailableRegions = useMemo(() => {
    const search = regionSearch.trim().toLowerCase();
    if (!search) {
      return availableRegions;
    }

    return availableRegions.filter((region) => {
      const haystack = `${region.name} ${region.code}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [availableRegions, regionSearch]);

  useEffect(() => {
    if (!message || messageType === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [message, messageType]);

  useEffect(() => {
    async function loadPopularScanConfig() {
      try {
        setSettingsLoading(true);
        const [regions, settings] = await Promise.all([
          getPopularScanRegions(),
          getPopularScanSettings(),
        ]);
        setAvailableRegions(regions);
        setScanSettings({
          region_codes: settings.region_codes,
          max_results: settings.max_results,
        });
      } catch (err) {
        console.error("Failed to load popular scan settings", err);
        setMessage("Failed to load popular scan settings");
        setMessageType("error");
      } finally {
        setSettingsLoading(false);
      }
    }

    void loadPopularScanConfig();
  }, []);

  function toggleScanRegion(regionCode: string) {
    setScanSettings((current) => {
      const exists = current.region_codes.includes(regionCode);
      return {
        ...current,
        region_codes: exists
          ? current.region_codes.filter((code) => code !== regionCode)
          : [...current.region_codes, regionCode],
      };
    });
  }

  async function handleSaveScanSettings() {
    try {
      setSettingsSaving(true);
      setMessage("Saving popular scan settings...");
      setMessageType("info");

      const saved = await updatePopularScanSettings(scanSettings);
      setScanSettings(saved);
      setMessage("Popular scan settings saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save popular scan settings", err);
      setMessage(
        err instanceof Error ? err.message : "Failed to save popular scan settings"
      );
      setMessageType("error");
    } finally {
      setSettingsSaving(false);
    }
  }

  function selectTab(tab: SettingsTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  return (
    <ProtectedPageShell
      title="Settings"
      description="Manage configuration shared across the admin app."
      sidebar={
        <div className="space-y-2">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive ? "bg-blue-500 text-white" : "bg-white text-gray-500"
                  }`}
                >
                  Tab
                </span>
              </button>
            );
          })}
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {activeTab === "youtube-popular"
              ? "Youtube Popular Scan Settings"
              : "Settings"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "youtube-popular"
              ? "Choose scan regions and fetch limits for YouTube popular videos."
              : "Manage shared app settings."}
          </p>
        </div>

        {activeTab === "youtube-popular" ? (
          <PopularSettingsPanel
            availableRegions={availableRegions}
            filteredAvailableRegions={filteredAvailableRegions}
            regionSearch={regionSearch}
            scanSettings={scanSettings}
            settingsLoading={settingsLoading}
            settingsSaving={settingsSaving}
            onRegionSearchChange={setRegionSearch}
            onMaxResultsChange={(value) => {
              setScanSettings((current) => ({
                ...current,
                max_results: Number.isFinite(value)
                  ? Math.max(1, Math.min(50, value))
                  : 1,
              }));
            }}
            onToggleRegion={toggleScanRegion}
            onSelectAllRegions={() =>
              setScanSettings((current) => ({
                ...current,
                region_codes: availableRegions.map((region) => region.code),
              }))
            }
            onSave={() => void handleSaveScanSettings()}
            className="flex-1"
          />
        ) : null}

        <Toast
          message={message}
          type={messageType}
          onClose={() => {
            setMessage(null);
            setMessageType(null);
          }}
        />
      </div>
    </ProtectedPageShell>
  );
}
