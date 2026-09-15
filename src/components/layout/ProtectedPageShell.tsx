"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CSSProperties, ReactNode, useId, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

type ProtectedPageShellProps = {
  title: string;
  description?: string;
  sidebar: ReactNode;
  children: ReactNode;
  sidebarClassName?: string;
  sidebarStyle?: CSSProperties;
  contentClassName?: string;
  sidebarAfter?: ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  settingsHref?: string;
};

export default function ProtectedPageShell({
  title,
  description,
  sidebar,
  children,
  sidebarClassName = "w-72",
  sidebarStyle,
  contentClassName = "flex-1 overflow-y-auto p-4",
  sidebarAfter,
  sidebarCollapsed: controlledSidebarCollapsed,
  onSidebarToggle,
  settingsHref = "/settings?tab=youtube-popular",
}: ProtectedPageShellProps) {
  const pathname = usePathname();
  const sidebarId = useId();
  const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarCollapsed = controlledSidebarCollapsed ?? internalSidebarCollapsed;

  function toggleSidebar() {
    if (controlledSidebarCollapsed === undefined) {
      setInternalSidebarCollapsed((collapsed) => !collapsed);
    }
    onSidebarToggle?.();
  }

  const isSettingsActive = pathname === "/settings";

  return (
    <div className="protected-shell flex h-[calc(100vh-56px)] overflow-hidden bg-gray-50">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
        <h1 className="min-w-0 truncate font-semibold">{title}</h1>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((open) => !open)}
          aria-expanded={mobileSidebarOpen}
          aria-controls={sidebarId}
          className="min-h-11 shrink-0 rounded-lg border border-gray-200 px-3 text-sm"
        >
          {mobileSidebarOpen ? "Hide controls" : "Browse & controls"}
        </button>
      </div>
      <aside
        id={sidebarId}
        style={sidebarCollapsed ? { width: 0, visibility: "hidden" } : sidebarStyle}
        data-mobile-open={mobileSidebarOpen}
        data-collapsed={sidebarCollapsed}
        className={`page-sidebar flex shrink-0 flex-col overflow-hidden bg-white transition-[width,padding] duration-200 ${
          sidebarCollapsed ? "border-r-0 p-0" : "border-r border-gray-200 p-4"
        } ${sidebarCollapsed ? "" : sidebarClassName}`}
      >
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">{sidebar}</div>

        <div className="mt-4 flex justify-start border-t border-gray-200 pt-4">
          <Link
            href={settingsHref}
            aria-label="Open settings"
            title="Settings"
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
              isSettingsActive
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </aside>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-controls={sidebarId}
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="z-20 hidden lg:flex w-6 shrink-0 items-center justify-center border-r border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

      {!sidebarCollapsed && sidebarAfter ? <div className="hidden lg:contents">{sidebarAfter}</div> : null}

      <section className={"page-content min-w-0 " + contentClassName}>{children}</section>
    </div>
  );
}
