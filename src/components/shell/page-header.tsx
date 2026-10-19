import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-ink-2">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
