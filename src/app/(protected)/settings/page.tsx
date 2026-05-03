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
import {
  createDraftPrompt,
  deleteDraftPrompt,
  getDraftPrompts,
  updateDraftPrompt,
} from "@/lib/services/draft-prompts";
import { DraftPrompt, PopularScanSettings, YouTubeRegion } from "@/types/types";

import PopularSettingsPanel from "./components/PopularSettingsPanel";
import PromptSettingsPanel from "./components/PromptSettingsPanel";

const DEFAULT_SCAN_SETTINGS: PopularScanSettings = {
  region_codes: ["US"],
  max_results: 10,
};

const SETTINGS_TABS = [
  { key: "youtube-popular", label: "Youtube Popular" },
  { key: "prompts", label: "Prompts" },
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
  const [prompts, setPrompts] = useState<DraftPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptDeleting, setPromptDeleting] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptActive, setPromptActive] = useState(true);

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

  useEffect(() => {
    async function loadPrompts() {
      try {
        setPromptsLoading(true);
        const data = await getDraftPrompts();
        setPrompts(data);
      } catch (err) {
        console.error("Failed to load prompts", err);
        setMessage("Failed to load prompts");
        setMessageType("error");
      } finally {
        setPromptsLoading(false);
      }
    }

    void loadPrompts();
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

  function resetPromptForm() {
    setSelectedPromptId(null);
    setPromptName("");
    setPromptText("");
    setPromptActive(true);
  }

  function selectPrompt(prompt: DraftPrompt) {
    setSelectedPromptId(prompt.id);
    setPromptName(prompt.name);
    setPromptText(prompt.prompt);
    setPromptActive(prompt.is_active);
  }

  async function handleSavePrompt() {
    const name = promptName.trim();
    const prompt = promptText.trim();

    if (!name || !prompt) {
      setMessage("Prompt name and prompt are required.");
      setMessageType("error");
      return;
    }

    try {
      setPromptSaving(true);
      setMessage("Saving prompt...");
      setMessageType("info");

      const saved = selectedPromptId
        ? await updateDraftPrompt(selectedPromptId, {
            name,
            prompt,
            is_active: promptActive,
          })
        : await createDraftPrompt({
            name,
            prompt,
            is_active: promptActive,
          });

      setPrompts((current) => {
        const exists = current.some((item) => item.id === saved.id);
        if (exists) {
          return current.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...current];
      });
      selectPrompt(saved);
      setMessage("Prompt saved.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to save prompt", err);
      setMessage(err instanceof Error ? err.message : "Failed to save prompt");
      setMessageType("error");
    } finally {
      setPromptSaving(false);
    }
  }

  async function handleDeletePrompt() {
    if (!selectedPromptId) {
      return;
    }

    try {
      setPromptDeleting(true);
      setMessage("Deleting prompt...");
      setMessageType("info");
      await deleteDraftPrompt(selectedPromptId);
      setPrompts((current) => current.filter((prompt) => prompt.id !== selectedPromptId));
      resetPromptForm();
      setMessage("Prompt deleted.");
      setMessageType("success");
    } catch (err) {
      console.error("Failed to delete prompt", err);
      setMessage(err instanceof Error ? err.message : "Failed to delete prompt");
      setMessageType("error");
    } finally {
      setPromptDeleting(false);
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
              : activeTab === "prompts"
                ? "Draft Prompts"
              : "Settings"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "youtube-popular"
              ? "Choose scan regions and fetch limits for YouTube popular videos."
              : activeTab === "prompts"
                ? "Write reusable draft prompts for transcript article generation."
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

        {activeTab === "prompts" ? (
          <PromptSettingsPanel
            prompts={prompts}
            selectedPromptId={selectedPromptId}
            promptName={promptName}
            promptText={promptText}
            promptActive={promptActive}
            loading={promptsLoading}
            saving={promptSaving}
            deleting={promptDeleting}
            onSelectPrompt={selectPrompt}
            onNewPrompt={resetPromptForm}
            onNameChange={setPromptName}
            onPromptChange={setPromptText}
            onActiveChange={setPromptActive}
            onSave={() => void handleSavePrompt()}
            onDelete={() => void handleDeletePrompt()}
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
