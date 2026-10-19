"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/components/ui/cn";
import { NavIcon } from "./nav-icon";

/** Barre compacte mobile : 4 raccourcis + menu complet. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.mobile);
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <nav aria-label="Menu complet" className="absolute inset-x-3 bottom-20 rounded-2xl bg-surface-1 p-2 shadow-xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
            {[...NAV_ITEMS, { href: "/systeme" as const, label: "Système / Runs", icon: "settings" }].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", isActive(pathname, item.href) ? "bg-surface-2 font-medium" : "")}>
                <NavIcon name={item.icon} /> {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
      <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface-1/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px]", active ? "text-ink-1" : "text-ink-3")}>
              <NavIcon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] text-ink-3">
          <Menu aria-hidden size={20} /> Plus
        </button>
      </nav>
    </>
  );
}
