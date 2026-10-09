"use client";

import { FormEvent, useEffect, useState } from "react";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/ui/Sidebar";
import Toast from "@/components/ui/Toast";
import { VideoPaginationControls } from "@/components/ui/VideoFilters";
import { getLead, getLeads, updateLead } from "@/lib/services/leads";
import { Lead, LeadsResponse, LeadStatus, LeadUpdate } from "@/types/types";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost", "spam"];
const FIELD_CLASS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500";

function labelForStatus(status: LeadStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const tone = status === "won" ? "bg-emerald-50 text-emerald-700"
    : status === "lost" || status === "spam" ? "bg-gray-100 text-gray-600"
      : "bg-blue-50 text-blue-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{labelForStatus(status)}</span>;
}

export default function LeadsPage() {
  const [result, setResult] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReloadVersion, setDetailReloadVersion] = useState(0);
  const [editStatus, setEditStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLeads() {
      setLoading(true);
      setListError(null);
      try {
        const response = await getLeads({ page, size, search, source, status: status || undefined });
        if (cancelled) return;
        setResult(response);
        if (response.total_pages > 0 && page > response.total_pages) setPage(response.total_pages);
      } catch (error) {
        if (cancelled) return;
        setResult(null);
        setListError(errorMessage(error, "Unable to load leads."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadLeads();
    return () => { cancelled = true; };
  }, [page, size, search, source, status, reloadVersion]);

  useEffect(() => {
    let cancelled = false;
    setSelectedLead(null);
    setDetailError(null);
    setSaveError(null);
    if (selectedId === null) {
      setDetailLoading(false);
      return;
    }
    const leadId = selectedId;
    async function loadDetail() {
      setDetailLoading(true);
      try {
        const lead = await getLead(leadId);
        if (cancelled) return;
        setSelectedLead(lead);
        setEditStatus(lead.status);
        setNotes(lead.internal_notes);
      } catch (error) {
        if (!cancelled) setDetailError(errorMessage(error, "Unable to load enquiry details."));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => { cancelled = true; };
  }, [selectedId, detailReloadVersion]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function changeStatus(nextStatus: LeadStatus | "") {
    setStatus(nextStatus);
    setPage(1);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setSource(sourceInput.trim());
    setPage(1);
  }

  function resetFilters() {
    setSearchInput("");
    setSourceInput("");
    setSearch("");
    setSource("");
    setStatus("");
    setPage(1);
  }

  function selectLead(leadId: number | null) {
    if (saving || leadId === selectedId) return;
    if (hasChanges && !window.confirm("Discard unsaved changes to this lead?")) return;
    setSelectedId(leadId);
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead || saving) return;
    const changes: LeadUpdate = {};
    if (editStatus !== selectedLead.status) changes.status = editStatus;
    if (notes !== selectedLead.internal_notes) changes.internal_notes = notes;
    if (Object.keys(changes).length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const lead = await updateLead(selectedLead.id, changes);
      setSelectedLead(lead);
      setEditStatus(lead.status);
      setNotes(lead.internal_notes);
      setReloadVersion((version) => version + 1);
      setMessage("Lead updated.");
    } catch (error) {
      setSaveError(errorMessage(error, "Unable to save lead. Your changes are still in the form."));
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = selectedLead !== null && (editStatus !== selectedLead.status || notes !== selectedLead.internal_notes);
  const sourceFields = selectedLead ? [
    ["Host site", selectedLead.host_site],
    ["Landing page", selectedLead.landing_page],
    ["Referrer", selectedLead.referrer],
    ["UTM source", selectedLead.utm_source],
    ["UTM medium", selectedLead.utm_medium],
    ["UTM campaign", selectedLead.utm_campaign],
    ["UTM term", selectedLead.utm_term],
    ["UTM content", selectedLead.utm_content],
  ] : [];

  return (
    <>
      <ProtectedPageShell
        title="Leads"
        description="Manage consulting enquiries."
        sidebar={<Sidebar items={[
          { id: "all", label: "All leads", isActive: status === "", onClick: () => changeStatus("") },
          ...STATUSES.map((value) => ({
            id: value,
            label: labelForStatus(value),
            isActive: status === value,
            onClick: () => changeStatus(value),
          })),
        ]} />}
      >
        <div className="space-y-5">
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="min-w-0 flex-1 basis-56 space-y-1">
              <span className="text-sm font-medium text-gray-700">Search enquiries</span>
              <input type="search" maxLength={200} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name, email, subject or message" className={FIELD_CLASS} />
            </label>
            <label className="min-w-0 flex-1 basis-40 space-y-1">
              <span className="text-sm font-medium text-gray-700">Source (UTM source)</span>
              <input maxLength={200} value={sourceInput} onChange={(event) => setSourceInput(event.target.value)} placeholder="e.g. newsletter" className={FIELD_CLASS} />
            </label>
            <label className="min-w-0 basis-36 space-y-1">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select value={status} onChange={(event) => changeStatus(event.target.value as LeadStatus | "")} className={FIELD_CLASS}>
                <option value="">All statuses</option>
                {STATUSES.map((value) => <option key={value} value={value}>{labelForStatus(value)}</option>)}
              </select>
            </label>
            <Button type="submit" className="min-h-10 !px-3 !text-sm">Apply</Button>
            <Button type="button" variant="secondary" className="!w-auto min-h-10 !px-3 !text-sm" onClick={resetFilters}>Reset</Button>
          </form>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
            <section aria-label="Enquiry list" aria-busy={loading} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-900">Enquiries{result && !loading ? ` (${result.total})` : ""}</h2>
                <Button type="button" disabled={loading} onClick={() => setReloadVersion((version) => version + 1)} className="!text-sm disabled:opacity-50">Refresh</Button>
              </div>
              {loading ? (
                <div role="status" className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading leads...</div>
              ) : listError ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{listError}</div>
              ) : !result?.items.length ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">No leads match these filters.</div>
              ) : (
                <div className="space-y-3">
                  {result.items.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      disabled={saving}
                      aria-pressed={selectedId === lead.id}
                      onClick={() => selectLead(lead.id)}
                      className={`block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-wait ${selectedId === lead.id ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words font-semibold text-gray-900">{lead.name}</span>
                        <StatusBadge status={lead.status} />
                      </div>
                      <p className="mt-1 break-all text-sm text-gray-600">{lead.email}</p>
                      <p className="mt-3 break-words text-sm font-medium text-gray-800">{lead.subject || "Contact enquiry"}</p>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">{lead.message}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <time dateTime={lead.submitted_at}>{formatDate(lead.submitted_at)}</time>
                        <span className="break-all">Source: {lead.utm_source || lead.host_site}</span>
                        <span>#{lead.id}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {result && !listError ? (
                <VideoPaginationControls
                  itemLabel="leads"
                  pagination={{ page: result.page, size: result.size, total: result.total, pages: Math.max(1, result.total_pages), has_next: result.has_next, has_prev: result.has_previous }}
                  pageSize={size}
                  disabled={loading}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => { setSize(nextSize); setPage(1); }}
                />
              ) : null}
            </section>

            <section aria-label="Enquiry details" aria-busy={detailLoading} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-900">Enquiry details</h2>
                {selectedId !== null ? <Button type="button" disabled={saving} onClick={() => selectLead(null)} className="!text-sm disabled:opacity-50">Close</Button> : null}
              </div>
              {selectedId === null ? (
                <p className="text-sm text-gray-500">Select an enquiry to view its details and update the lead.</p>
              ) : detailLoading ? (
                <p role="status" className="text-sm text-gray-500">Loading enquiry...</p>
              ) : detailError ? (
                <div className="space-y-3">
                  <p role="alert" className="text-sm text-red-700">{detailError}</p>
                  <Button type="button" onClick={() => setDetailReloadVersion((version) => version + 1)} className="!text-sm">Retry</Button>
                </div>
              ) : selectedLead ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-3"><h3 className="break-words text-lg font-semibold text-gray-900">{selectedLead.name}</h3><StatusBadge status={selectedLead.status} /></div>
                    <p className="mt-2 break-all text-sm text-gray-700"><a className="text-blue-700 underline" href={`mailto:${selectedLead.email}`}>{selectedLead.email}</a></p>
                    {selectedLead.phone ? <p className="mt-1 text-sm text-gray-700">{selectedLead.phone}</p> : null}
                    <p className="mt-2 text-xs text-gray-500">Submitted {formatDate(selectedLead.submitted_at)} · #{selectedLead.id}</p>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="break-words font-medium text-gray-900">{selectedLead.subject || "Contact enquiry"}</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{selectedLead.message}</p>
                  </div>
                  <form onSubmit={saveLead} className="space-y-4 border-t border-gray-200 pt-4">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-gray-700">Lead status</span>
                      <select value={editStatus} disabled={saving} onChange={(event) => setEditStatus(event.target.value as LeadStatus)} className={FIELD_CLASS}>
                        {STATUSES.map((value) => <option key={value} value={value}>{labelForStatus(value)}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-gray-700">Internal notes</span>
                      <textarea rows={6} maxLength={10000} value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} placeholder="Follow-up plans, qualification details and conversations" className={FIELD_CLASS} />
                    </label>
                    {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button type="submit" disabled={saving || !hasChanges} className="!px-3 !py-2 !text-sm disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</Button>
                      <p className="text-xs text-gray-500">{hasChanges ? "Unsaved changes" : `Updated ${formatDate(selectedLead.updated_at)}`}</p>
                    </div>
                  </form>
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-medium text-gray-900">Source information</h3>
                    <dl className="mt-3 space-y-3 text-sm">
                      {sourceFields.map(([label, value]) => (
                        <div key={label}><dt className="text-xs font-medium text-gray-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-all text-gray-700">{value || "Not provided"}</dd></div>
                      ))}
                    </dl>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </ProtectedPageShell>
      <Toast message={message} type="success" onClose={() => setMessage(null)} />
    </>
  );
}
