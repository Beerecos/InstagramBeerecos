import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-card bg-surface-1 p-5 ring-1 ring-line", className)} {...props} />;
}

export function CardHeader({ title, description, action, as: As = "h2" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <As className="text-base font-semibold tracking-tight text-ink-1">{title}</As>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-ink-3">{icon}</div> : null}
      <p className="font-medium text-ink-1">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
