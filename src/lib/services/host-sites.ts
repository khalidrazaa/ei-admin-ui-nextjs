import { apiFetch } from "@/lib/api";
import { HostSite, HostSiteRequest } from "@/types/types";

export async function getHostSites(activeOnly = false): Promise<HostSite[]> {
  const params = activeOnly ? "?active_only=true" : "";
  return apiFetch(`/admin/settings/host-sites${params}`, {
    method: "GET",
  }) as Promise<HostSite[]>;
}

export async function createHostSite(payload: HostSiteRequest): Promise<HostSite> {
  return apiFetch("/admin/settings/host-sites", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<HostSite>;
}

export async function updateHostSite(
  hostSiteId: number,
  payload: Partial<HostSiteRequest>
): Promise<HostSite> {
  return apiFetch(`/admin/settings/host-sites/${hostSiteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<HostSite>;
}

export async function deleteHostSite(hostSiteId: number): Promise<void> {
  await apiFetch(`/admin/settings/host-sites/${hostSiteId}`, {
    method: "DELETE",
  });
}
