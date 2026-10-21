"use client";

import { Scissors, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { applyCutAction, undoCutAction } from "@/app/(app)/_actions/montages";
import { Button, cn } from "@/components/ui";
import type { CaptionWord, Range } from "@/domain/video/edit";
import { keptMs } from "@/domain/video/montage";
import { applyAutoCut, planAutoCut } from "@/domain/video/pipeline";

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/**
 * Plan de coupe numéroté (même calcul que `npm run video -- autocut`) : les suggestions sont cochées, l'utilisateur
 * décide, la durée finale se met à jour avant d'écrire. Rien n'est appliqué sans clic sur « Appliquer ».
 */
export function CutPlan({ montageId, captions, durationMs, ranges, canUndo, disabled }: { montageId: string; captions: CaptionWord[]; durationMs: number; ranges: Range[]; canUndo: boolean; disabled?: boolean }) {
  const router = useRouter();
  const clauses = useMemo(() => planAutoCut(captions), [captions]);
  const [drop, setDrop] = useState<Set<number>>(() => new Set(clauses.filter((c) => c.suggestDrop).map((c) => c.n)));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const after = useMemo(() => keptMs(applyAutoCut(captions, clauses, drop, durationMs)), [captions, clauses, drop, durationMs]);

  const toggle = (n: number) =>
    setDrop((d) => {
      const next = new Set(d);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        Cochez les phrases à retirer. Les hésitations (« euh », « ben ») et les silences de plus de 0,35 s sont toujours coupés. Durée : <strong>{sec(keptMs(ranges))}</strong> → <strong>{sec(after)}</strong>
      </p>
      <ol className="divide-y divide-line rounded-xl ring-1 ring-line">
        {clauses.map((c) => (
          <li key={c.n}>
            <label className={cn("flex cursor-pointer items-start gap-3 px-3 py-2 text-sm", drop.has(c.n) && "bg-surface-2 text-ink-3 line-through")}>
              <input type="checkbox" className="mt-1" checked={drop.has(c.n)} onChange={() => toggle(c.n)} disabled={disabled || pending} aria-label={`Retirer la phrase ${c.n}`} />
              <span className="w-8 shrink-0 tabular-nums text-ink-3">{c.n}</span>
              <span className="w-14 shrink-0 tabular-nums text-ink-3">{sec(c.fromMs)}</span>
              <span className="min-w-0 flex-1">
                {c.text}
                {c.suggestDrop ? <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2 no-underline">{c.suggestDrop}</span> : null}
                {c.fillers ? <span className="ml-2 text-xs text-ink-3">({c.fillers} hésitation{c.fillers > 1 ? "s" : ""})</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Scissors size={16} aria-hidden />} disabled={disabled || pending} onClick={() => act(() => applyCutAction(montageId, [...drop]))}>
          {pending ? "Enregistrement…" : "Appliquer la coupe"}
        </Button>
        {canUndo ? (
          <Button variant="secondary" icon={<Undo2 size={16} aria-hidden />} disabled={disabled || pending} onClick={() => act(() => undoCutAction(montageId))}>
            Annuler la dernière coupe
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-status-critical">{error}</p> : null}
    </div>
  );
}
