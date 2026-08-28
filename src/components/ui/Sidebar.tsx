"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export type SidebarSubItem = {
  id: string | number;
  label: ReactNode;
  onClick?: () => void;
  actions?: ReactNode;
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
};

export type SidebarItem = {
  id: string | number;
  label: ReactNode;
  onClick?: () => void;
  actions?: ReactNode;
  subitems?: SidebarSubItem[];
  footer?: ReactNode;
  isActive?: boolean;
  isExpanded?: boolean;
  disabled?: boolean;
  className?: string;
};

type SidebarProps = {
  items: SidebarItem[];
  header?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
};

export default function Sidebar({
  items,
  header,
  emptyState,
  className = "",
}: SidebarProps) {
  return (
    <nav aria-label="Sidebar navigation" className={className}>
      {header}

      {items.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const hasChildren = Boolean(item.subitems?.length || item.footer);
            const ItemElement = item.onClick ? "button" : "div";

            return (
              <div
                key={item.id}
                className={`rounded-lg p-1 transition ${
                  item.isActive
                    ? "border-green-400 bg-green-50"
                    : "bg-white hover:bg-gray-50"
                } ${item.className ?? ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <ItemElement
                    {...(item.onClick
                      ? {
                          type: "button" as const,
                          onClick: item.onClick,
                          disabled: item.disabled,
                        }
                      : {})}
                    className={`flex min-w-0 items-center gap-2 text-left ${
                      item.onClick ? "cursor-pointer" : ""
                    } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {hasChildren ? (
                      item.isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )
                    ) : null}
                    <span className="truncate font-medium">{item.label}</span>
                  </ItemElement>

                  {item.actions ? (
                    <div className="flex shrink-0 items-center gap-2">{item.actions}</div>
                  ) : null}
                </div>

                {item.isExpanded && hasChildren ? (
                  <div className="mt-3 space-y-2 pl-5">
                    {item.subitems?.length ? (
                      <div className="flex flex-col gap-2">
                        {item.subitems.map((subitem) => {
                          const SubitemElement = subitem.onClick ? "button" : "div";

                          return (
                            <div
                              key={subitem.id}
                              className={`flex items-center justify-between rounded bg-gray-200 px-2 py-0.5 text-xs ${
                                subitem.isActive ? "bg-green-100" : ""
                              } ${subitem.className ?? ""}`}
                            >
                              <SubitemElement
                                {...(subitem.onClick
                                  ? {
                                      type: "button" as const,
                                      onClick: subitem.onClick,
                                      disabled: subitem.disabled,
                                    }
                                  : {})}
                                className={`min-w-0 truncate text-left ${
                                  subitem.onClick ? "cursor-pointer" : ""
                                } ${subitem.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                {subitem.label}
                              </SubitemElement>
                              {subitem.actions ? (
                                <div className="ml-2 flex shrink-0 items-center">
                                  {subitem.actions}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {item.footer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
