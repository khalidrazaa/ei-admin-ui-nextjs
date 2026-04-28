"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CSSProperties, ReactNode } from "react";
import { Settings } from "lucide-react";

type ProtectedPageShellProps = {
  title: string;
  description?: string;
  sidebar: ReactNode;
  children: ReactNode;
  sidebarClassName?: string;
  sidebarStyle?: CSSProperties;
  contentClassName?: string;
  sidebarAfter?: ReactNode;
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
  settingsHref = "/settings?tab=youtube-popular",
}: ProtectedPageShellProps) {
  const pathname = usePathname();
  const isSettingsActive = pathname === "/settings";

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-gray-50">
      <aside
        style={sidebarStyle}
        className={`flex shrink-0 flex-col border-r border-gray-200 bg-white p-4 ${sidebarClassName}`}
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

      {sidebarAfter}

      <section className={contentClassName}>{children}</section>
    </div>
  );
}
