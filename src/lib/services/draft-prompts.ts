import { apiFetch } from "@/lib/api";
import { DraftPrompt, DraftPromptRequest } from "@/types/types";

export async function getDraftPrompts(activeOnly = false): Promise<DraftPrompt[]> {
  const params = activeOnly ? "?active_only=true" : "";
  return apiFetch(`/admin/settings/draft-prompts${params}`, {
    method: "GET",
  }) as Promise<DraftPrompt[]>;
}

export async function createDraftPrompt(
  payload: DraftPromptRequest
): Promise<DraftPrompt> {
  return apiFetch("/admin/settings/draft-prompts", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<DraftPrompt>;
}

export async function updateDraftPrompt(
  promptId: number,
  payload: Partial<DraftPromptRequest>
): Promise<DraftPrompt> {
  return apiFetch(`/admin/settings/draft-prompts/${promptId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<DraftPrompt>;
}

export async function deleteDraftPrompt(promptId: number): Promise<void> {
  await apiFetch(`/admin/settings/draft-prompts/${promptId}`, {
    method: "DELETE",
  });
}
