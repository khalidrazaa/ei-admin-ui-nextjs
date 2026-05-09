import { HostSite } from "@/types/types";

type HostSiteSettingsPanelProps = {
  hostSites: HostSite[];
  selectedHostSiteId: number | null;
  hostValue: string;
  hostActive: boolean;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  onSelectHostSite: (hostSite: HostSite) => void;
  onNewHostSite: () => void;
  onHostValueChange: (value: string) => void;
  onHostActiveChange: (value: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
};

export default function HostSiteSettingsPanel({
  hostSites,
  selectedHostSiteId,
  hostValue,
  hostActive,
  loading,
  saving,
  deleting,
  onSelectHostSite,
  onNewHostSite,
  onHostValueChange,
  onHostActiveChange,
  onSave,
  onDelete,
}: HostSiteSettingsPanelProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex min-h-[420px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
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

      <div className="flex min-h-[420px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {selectedHostSiteId ? "Edit Host Site" : "New Host Site"}
          </h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Host Site Domain
              </label>
              <input
                value={hostValue}
                onChange={(event) => onHostValueChange(event.target.value)}
                placeholder="example: explainit.tech"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <div className="mt-2 text-xs text-gray-500">
                Use domain only. Example: `shyblushh.com`
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
