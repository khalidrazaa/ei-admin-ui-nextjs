import { apiFetch } from "@/lib/api";
import {
  PublicApiKey,
  PublicApiKeyGenerateRequest,
  PublicApiKeyGenerateResponse,
} from "@/types/types";

export async function getPublicApiKeys(
  options: {
    activeOnly?: boolean;
    host?: string;
  } = {}
): Promise<PublicApiKey[]> {
  const query = new URLSearchParams();
  if (options.activeOnly) {
    query.set("active_only", "true");
  }
  if (options.host) {
    query.set("host", options.host);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch(`/admin/settings/public-api-keys${suffix}`, {
    method: "GET",
  }) as Promise<PublicApiKey[]>;
}

export async function generatePublicApiKey(
  payload: PublicApiKeyGenerateRequest
): Promise<PublicApiKeyGenerateResponse> {
  return apiFetch("/admin/settings/public-api-keys/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<PublicApiKeyGenerateResponse>;
}

export async function revokePublicApiKey(apiKeyId: number): Promise<PublicApiKey> {
  return apiFetch(`/admin/settings/public-api-keys/${apiKeyId}/revoke`, {
    method: "POST",
  }) as Promise<PublicApiKey>;
}
