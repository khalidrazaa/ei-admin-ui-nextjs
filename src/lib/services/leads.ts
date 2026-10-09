import { apiFetch } from "@/lib/api";
import { Lead, LeadListParams, LeadsResponse, LeadUpdate } from "@/types/types";

export async function getLeads(params: LeadListParams = {}): Promise<LeadsResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    size: String(params.size ?? 20),
  });
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.source) query.set("source", params.source);

  return apiFetch<LeadsResponse>(`/admin/leads?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function getLead(leadId: number): Promise<Lead> {
  return apiFetch<Lead>(`/admin/leads/${leadId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function updateLead(leadId: number, payload: LeadUpdate): Promise<Lead> {
  return apiFetch<Lead>(`/admin/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
