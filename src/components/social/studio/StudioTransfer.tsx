"use client";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "@/components/social/router";
import * as api from "@/lib/social/api";

/** Identity and version, never a signed media URL. Idempotency is enforced by the server. */
export default function StudioTransfer({ sourceType, sourceId, expectedSourceVersion, disabled = false }: {
  sourceType: "montage" | "reel"; sourceId: string; expectedSourceVersion: string; disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function transfer() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const postChannel = searchParams.get("postChannel");
      const channel = postChannel === "linkedin" || postChannel === "instagram" ? postChannel : undefined;
      const result = await api.transferStudioMedia({ sourceType, sourceId, expectedSourceVersion, ...(channel ? { channel } : {}) });
      if (channel && result.channel !== channel) throw new Error("Le brouillon retourné ne correspond pas au réseau demandé. Votre montage est conservé ; réessayez le transfert.");
      if (!result.id) throw new Error("Le serveur n’a pas retourné de brouillon. Réessayez.");
      const next = new URLSearchParams(searchParams);
      for (const key of ["vue", "montage", "reel", "tab", "postChannel"]) next.delete(key);
      next.set("edit", result.id);
      navigate(`/publication?${next.toString()}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Transfert impossible. Votre montage est conservé."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <footer className="space-y-2 rounded-xl border border-line bg-white p-4">
    <p className="text-xs text-mut">Préparer un brouillon. Aucune publication ni programmation. Un rendu manquant reste à produire avant validation.</p>
    <button type="button" className="btn-red min-h-[44px] w-full" disabled={disabled || busy} aria-busy={busy} onClick={transfer}>
      {busy ? "Ouverture du post…" : "Envoyer vers le post"}
    </button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </footer>;
}
