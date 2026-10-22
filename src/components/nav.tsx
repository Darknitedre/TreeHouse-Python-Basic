"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { Icon } from "./icons";
import { cx } from "./ui";

/** Desktop sidebar navigation. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-brand">
          <Icon name="sparkles" />
        </span>
        <span className="font-semibold">Social Action Vault</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand text-brand-fg" : "text-text hover:bg-surface-2",
              )}
            >
              <Icon name={item.icon} width={18} height={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile bottom tab bar. */
export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) =>
    ["/dashboard", "/save", "/library", "/action-items", "/settings"].includes(i.href),
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-brand" : "text-muted",
            )}
          >
            <Icon name={item.icon} width={20} height={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
