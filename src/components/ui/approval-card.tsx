"use client";

import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

/** Affiche une demande d'approbation. La décision est validée côté serveur (approval_requests). */
export function ApprovalCard({ action, summary, requestedBy, onApprove, onReject, disabled }: { action: string; summary: ReactNode; requestedBy: string; onApprove?: () => void; onReject?: () => void; disabled?: boolean }) {
  return (
    <article className="rounded-2xl bg-accent-soft p-4 ring-1 ring-brand/30">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
        <ShieldCheck aria-hidden size={14} /> Validation requise · {action}
      </div>
      <div className="mt-2 text-sm text-ink-1">{summary}</div>
      <p className="mt-1 text-xs text-ink-3">Demandé par {requestedBy}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onApprove} disabled={disabled}>Valider</Button>
        <Button size="sm" variant="secondary" onClick={onReject} disabled={disabled}>Refuser</Button>
      </div>
    </article>
  );
}
