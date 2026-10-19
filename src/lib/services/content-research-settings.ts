import { apiFetch } from "@/lib/api";

export type ResearchSourceGroup = { name: string; urls: string[] };
export type ContentResearchSettings = {
  version: number;
  instructions: string;
  source_groups: ResearchSourceGroup[];
};
export type ContentResearchSettingsUpdate = Omit<ContentResearchSettings, "version"> & {
  expected_version: number;
};

export function getContentResearchSettings() {
  return apiFetch<ContentResearchSettings>("/admin/content-research-settings");
}

export function updateContentResearchSettings(payload: ContentResearchSettingsUpdate) {
  return apiFetch<ContentResearchSettings>("/admin/content-research-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
