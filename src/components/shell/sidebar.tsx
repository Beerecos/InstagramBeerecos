"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/components/ui/cn";
import { Logo } from "./logo";
import { NavIcon } from "./nav-icon";

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return <SidebarView pathname={usePathname()} footer={footer} />;
}

/** Rendu sans hook : sert aussi de version statique pendant le chargement de l'URL. */
export function SidebarView({ pathname, footer }: { pathname: string; footer?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface-1 px-3 py-6 lg:flex">
      <Link href="/" className="mb-1 px-3" aria-label="BeeMarketing — accueil">
        <Logo width={176} priority />
      </Link>
      <p className="mb-8 px-3 text-[11px] uppercase tracking-[0.18em] text-ink-3">pour BeeRecos</p>
      <nav aria-label="Navigation principale" className="flex-1 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-accent-soft font-medium text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink-1",
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/systeme" className={cn("mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-xs", isActive(pathname, "/systeme") ? "text-brand" : "text-ink-3 hover:text-ink-1")}>
        <Activity aria-hidden size={14} /> Système / Journal
      </Link>
      {footer}
    </aside>
  );
}
