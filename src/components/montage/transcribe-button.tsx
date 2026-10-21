"use client";

import { AudioLines } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transcribeMontageAction } from "@/app/(app)/_actions/montages";
import { Button } from "@/components/ui";

export function TranscribeButton({ montageId, again, disabled }: { montageId: string; again?: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant={again ? "secondary" : "primary"}
        icon={<AudioLines size={16} aria-hidden />}
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await transcribeMontageAction(montageId);
            if (r.error) setError(r.error);
            router.refresh();
          })
        }
      >
        {pending ? "Transcription en cours (1 à 2 min)…" : again ? "Transcrire à nouveau" : "Transcrire la prise"}
      </Button>
      {error ? <p role="alert" className="text-sm text-status-critical">{error}</p> : null}
    </div>
  );
}
