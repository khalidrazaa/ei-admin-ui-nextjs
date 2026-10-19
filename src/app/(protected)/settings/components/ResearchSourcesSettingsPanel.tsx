"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  ContentResearchSettings,
  getContentResearchSettings,
  updateContentResearchSettings,
} from "@/lib/services/content-research-settings";

type Draft = { instructions: string; source_groups: { name: string; urls: string }[] };
const toDraft = (settings: ContentResearchSettings): Draft => ({
  instructions: settings.instructions,
  source_groups: settings.source_groups.map(group => ({ name: group.name, urls: group.urls.join("\n") })),
});
const urlsFromText = (value: string) => value.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
const fieldClass = "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/20";

export default function ResearchSourcesSettingsPanel({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [saved, setSaved] = useState<ContentResearchSettings | null>(null);
  const [draft, setDraft] = useState<Draft>({ instructions: "", source_groups: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReload, setConfirmReload] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(toDraft(saved));
  const busy = loading || saving;

  const adopt = useCallback((settings: ContentResearchSettings) => {
    setSaved(settings);
    setDraft(toDraft(settings));
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const settings = await getContentResearchSettings();
      if (mounted.current) adopt(settings);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Unable to load research settings.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: Draft) {
    setDraft(next);
    setNotice("");
  }

  function changeGroup(index: number, key: "name" | "urls", value: string) {
    change({ ...draft, source_groups: draft.source_groups.map((group, i) => i === index ? { ...group, [key]: value } : group) });
  }

  async function save() {
    if (!saved || inFlight.current) return;
    setError("");
    setNotice("");
    const source_groups = draft.source_groups.map(group => ({ name: group.name.trim(), urls: urlsFromText(group.urls) }));
    if (!draft.instructions.trim() || source_groups.some(group => !group.name)) {
      setError("Research instructions and source group names are required.");
      return;
    }
    if (new Set(source_groups.flatMap(group => group.urls)).size > 100) { setError("Save up to 100 unique shared source URLs in total."); return; }
    if (source_groups.some(group => group.urls.length > 50 || group.urls.some(url => {
      try { return url.length > 2048 || new URL(url).protocol !== "https:"; }
      catch { return true; }
    }))) {
      setError("Use up to 50 public HTTPS URLs per group, one per line (maximum 2,048 characters each).");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const settings = await updateContentResearchSettings({
        expected_version: saved.version,
        instructions: draft.instructions.trim(),
        source_groups,
      });
      if (mounted.current) {
        adopt(settings);
        setNotice("Research settings saved. New research runs will use these shared sources and instructions.");
      }
    } catch (err) {
      if (mounted.current) setError(`${err instanceof Error ? err.message : "Unable to save research settings."} Your edits are kept; review or reload before saving again.`);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5" aria-label="Shared research settings" aria-busy={busy}>
      <p className="text-sm text-gray-600">Save sources and research instructions once and reuse them across topics. Shared settings apply automatically to new research runs; relevant sources are selected for each brief. Topic briefs can add optional URLs.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy} onClick={() => { if (dirty) setConfirmReload(true); else void load(); }}>Reload settings</Button>
        {loading && <p role="status" className="text-sm text-gray-500">Loading research settings...</p>}
        {!loading && dirty && <p className="text-sm text-amber-800">You have unsaved changes.</p>}
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {saved && <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="grid gap-2 text-sm font-medium" htmlFor="research-instructions">Research instructions
          <textarea id="research-instructions" disabled={busy} rows={10} maxLength={20000} required className={fieldClass} value={draft.instructions} onChange={event => change({ ...draft, instructions: event.target.value })}/>
        </label>
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Shared source groups</h3>
          <p className="text-sm text-gray-500">Use public HTTPS URLs, one per line. Save up to 20 groups with 50 URLs each, and 100 unique URLs in total. You can leave the list empty to rely on topic-specific sources and provider research.</p>
          {draft.source_groups.map((group, index) => <fieldset key={index} disabled={busy} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium">Source group {index + 1}</legend>
            <label className="grid gap-1 text-sm" htmlFor={`research-group-${index}`}>Group name
              <input id={`research-group-${index}`} required maxLength={100} className={fieldClass} value={group.name} onChange={event => changeGroup(index, "name", event.target.value)}/>
            </label>
            <label className="grid gap-1 text-sm" htmlFor={`research-urls-${index}`}>Source URLs (one per line)
              <textarea id={`research-urls-${index}`} rows={5} className={fieldClass} value={group.urls} onChange={event => changeGroup(index, "urls", event.target.value)}/>
            </label>
            <Button type="button" disabled={busy} aria-label={`Remove source group ${index + 1}`} onClick={() => change({ ...draft, source_groups: draft.source_groups.filter((_, i) => i !== index) })}>Remove group</Button>
          </fieldset>)}
          <Button type="button" disabled={busy || draft.source_groups.length >= 20} onClick={() => change({ ...draft, source_groups: [...draft.source_groups, { name: "", urls: "" }] })}>Add source group</Button>
        </div>
        <Button type="submit" disabled={busy || !dirty} className="disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving research settings..." : "Save research settings"}</Button>
      </form>}
      <ConfirmModal open={confirmReload} title="Discard unsaved research settings?" message="Reload the saved settings and discard your edits? If reload fails, your edits will be kept." confirmText="Discard and reload" cancelText="Keep editing" onCancel={() => setConfirmReload(false)} onConfirm={() => { setConfirmReload(false); void load(); }}/>
    </section>
  );
}
