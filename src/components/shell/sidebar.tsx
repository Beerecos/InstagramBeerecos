"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/components/ui/cn";
import { NavIcon } from "./nav-icon";

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[#14130f] px-3 py-5 text-[#e9e7e1] lg:flex">
      <Link href="/" className="mb-8 px-3">
        <span className="block text-lg font-semibold tracking-tight text-white">
          BeeSocial <span className="text-honey">AI</span>
        </span>
        <span className="text-xs text-[#a3a199]">pour BeeRecos</span>
      </Link>
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
                active ? "bg-white/10 font-medium text-white" : "text-[#c9c7bf] hover:bg-white/5 hover:text-white",
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
              {active ? <span aria-hidden className="ml-auto size-1.5 rounded-full bg-honey" /> : null}
            </Link>
          );
        })}
      </nav>
      <Link href="/systeme" className={cn("mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-xs", isActive(pathname, "/systeme") ? "text-white" : "text-[#a3a199] hover:text-white")}>
        <Activity aria-hidden size={14} /> Système / Runs
      </Link>
      {footer}
    </aside>
  );
}
