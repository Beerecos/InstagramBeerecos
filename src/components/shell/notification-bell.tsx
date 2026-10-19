"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";

export function NotificationBell({ items }: { items: { id: string; text: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Notifications (${items.length})`} className="relative flex size-9 items-center justify-center rounded-full text-ink-2 ring-1 ring-line hover:bg-surface-2">
        <Bell size={17} aria-hidden />
        {items.length > 0 ? <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">{items.length}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl bg-surface-1 p-2 shadow-xl ring-1 ring-line">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Notifications</p>
          {items.length === 0 ? <p className="px-2 py-4 text-sm text-ink-3">Rien à signaler.</p> : null}
          {items.map((n) => (
            <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2 text-sm text-ink-1 hover:bg-surface-2">{n.text}</Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
