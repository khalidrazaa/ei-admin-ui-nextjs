import { formatRelativeTime } from "@/lib/utils/formatters";
import { HostSite, PublicApiKey } from "@/types/types";

type HostSiteSettingsPanelProps = {
  hostSites: HostSite[];
  selectedHostSiteId: number | null;
  hostValue: string;
  hostActive: boolean;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  publicApiKeys: PublicApiKey[];
  apiKeysLoading: boolean;
  generatingApiKey: boolean;
  revokingApiKeyId: number | null;
  rotateOnGenerate: boolean;
  generatedApiKey: string | null;
  onSelectHostSite: (hostSite: HostSite) => void;
  onNewHostSite: () => void;
  onHostValueChange: (value: string) => void;
  onHostActiveChange: (value: boolean) => void;
  onRotateOnGenerateChange: (value: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onGenerateApiKey: () => void;
  onRevokeApiKey: (apiKeyId: number) => void;
  onClearGeneratedApiKey: () => void;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

export default function HostSiteSettingsPanel({
  hostSites,
  selectedHostSiteId,
  hostValue,
  hostActive,
  loading,
  saving,
  deleting,
  publicApiKeys,
  apiKeysLoading,
  generatingApiKey,
  revokingApiKeyId,
  rotateOnGenerate,
  generatedApiKey,
  onSelectHostSite,
  onNewHostSite,
  onHostValueChange,
  onHostActiveChange,
  onRotateOnGenerateChange,
  onSave,
  onDelete,
  onGenerateApiKey,
  onRevokeApiKey,
  onClearGeneratedApiKey,
}: HostSiteSettingsPanelProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex min-h-[520px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Saved Host Sites</h3>
            <p className="mt-1 text-xs text-gray-500">{hostSites.length} site(s)</p>
          </div>
          <button
            onClick={onNewHostSite}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            New
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Loading host sites...
            </div>
          ) : hostSites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No host sites saved yet.
            </div>
          ) : (
            <div className="space-y-2">
              {hostSites.map((hostSite) => {
                const isActive = selectedHostSiteId === hostSite.id;

                return (
                  <button
                    key={hostSite.id}
                    onClick={() => onSelectHostSite(hostSite)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="line-clamp-1 text-sm font-medium text-gray-900">
                      {hostSite.host}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          hostSite.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {hostSite.is_active ? "active" : "inactive"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-[520px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {selectedHostSiteId ? "Edit Host Site Domain" : "New Host Site Domain "}
          </h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <div>
              <input
                value={hostValue}
                onChange={(event) => onHostValueChange(event.target.value)}
                placeholder="example: explainit.tech"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>


            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Host API Keys |</h4>
                  <p className="mt-1 text-xs text-gray-500 in">
                    Generate and revoke keys used by public frontends for this host.
                  </p>
                </div>

                <button
                  onClick={onGenerateApiKey}
                  disabled={!selectedHostSiteId || generatingApiKey}
                  className="rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generatingApiKey ? "Generating..." : "Generate API Key"}
                </button>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={rotateOnGenerate}
                  onChange={(event) => onRotateOnGenerateChange(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={!selectedHostSiteId || generatingApiKey}
                />
                Deactivate old keys when generating a new one
              </label>

              {!selectedHostSiteId ? (
                <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500">
                  Save this host first to generate API keys.
                </p>
              ) : null}

              {generatedApiKey ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-amber-900">New key (visible only once)</p>
                    <button
                      onClick={onClearGeneratedApiKey}
                      className="text-xs font-medium text-amber-800 underline"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="mt-2 break-all rounded border border-amber-200 bg-white px-2 py-1 text-xs font-mono text-amber-900">
                    {generatedApiKey}
                  </div>
                  <p className="mt-2 text-[11px] text-amber-800">
                    Copy and set this in the matching frontend `.env.local` as `PUBLIC_APP_KEY`.
                  </p>
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {apiKeysLoading ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500">
                    Loading API keys...
                  </div>
                ) : publicApiKeys.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500">
                    No API keys for this host yet.
                  </div>
                ) : (
                  publicApiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-900">{apiKey.name}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            apiKey.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {apiKey.is_active ? "active" : "revoked"}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-1 text-[11px] text-gray-600">
                        <div>Prefix: <span className="font-mono">{apiKey.key_prefix}</span></div>
                        <div>Created: {formatDateTime(apiKey.created_at)}</div>
                        <div>
                          Last used: {apiKey.last_used_at ? formatRelativeTime(apiKey.last_used_at) : "never"}
                        </div>
                      </div>

                      {apiKey.is_active ? (
                        <div className="mt-3">
                          <button
                            onClick={() => onRevokeApiKey(apiKey.id)}
                            disabled={revokingApiKeyId === apiKey.id}
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {revokingApiKeyId === apiKey.id ? "Deleting..." : "Delete Key"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hostActive}
                onChange={(event) => onHostActiveChange(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Active for article assignment
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Host Site"}
              </button>

              {selectedHostSiteId ? (
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
