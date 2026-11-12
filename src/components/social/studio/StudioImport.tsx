"use client";
/**
 * Import dans le nouveau studio (2026-11-12) : plus d'écran intermédiaire. Une prise part dès qu'elle est choisie ;
 * plusieurs prises : on vérifie l'ordre, puis on envoie. Progression, erreur et reprise affichées dans le studio.
 */
import { useEffect, useRef, useState } from "react";
import { Film, Upload } from "lucide-react";
import { MAX_STRIP_MS, MAX_TAKES } from "@/domain/social/montage/edit";
import { useVideoImport } from "@/components/social/studio/video-import";

export default function StudioImport({ files: picked, onClose, onDone }: { files: File[]; onClose: () => void; onDone: (id: string) => void }) {
  const [files, setFiles] = useState(picked);
  const imp = useVideoImport({ onDone });
  const started = useRef(false);
  // Une seule prise : l'envoi démarre tout seul, une fois.
  useEffect(() => {
    if (started.current || picked.length !== 1) return;
    started.current = true;
    void imp.start(picked);
  }, [picked, imp]);
  const move = (i: number, by: number) => setFiles((f) => { const next = [...f]; [next[i], next[i + by]] = [next[i + by], next[i]]; return next; });
  const locked = imp.busy || Boolean(imp.receivedId);
  return (
    <div className="sv2-import-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Importer une vidéo" className="sv2-panel sv2-import">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Upload aria-hidden size={20} /> Importer une vidéo</h2>
        {files.length > 1 ? (
          <>
            <p className="text-sm text-[#AAB4C3]">Les prises sont montées bout à bout dans cet ordre.</p>
            <ol aria-label="Ordre des prises" className="space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1">
                  <span className="w-16 shrink-0 font-semibold">Prise {i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[#AAB4C3]">{f.name}</span>
                  <button type="button" className="min-h-11 px-2" disabled={i === 0 || locked} onClick={() => move(i, -1)} aria-label={`Monter ${f.name}`}>↑</button>
                  <button type="button" className="min-h-11 px-2" disabled={i === files.length - 1 || locked} onClick={() => move(i, 1)} aria-label={`Descendre ${f.name}`}>↓</button>
                </li>
              ))}
            </ol>
          </>
        ) : <p className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm"><Film aria-hidden size={16} /><span className="min-w-0 flex-1 truncate">{files[0]?.name}</span><span className="text-xs text-[#AAB4C3]">{Math.round((files[0]?.size ?? 0) / 1024 / 1024)} Mo</span></p>}
        {imp.step ? <p role="status" className="flex items-center gap-2 text-sm"><span aria-hidden className="sv2-spinner" />{imp.step}</p> : null}
        {imp.error ? <p role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{imp.error}</p> : null}
        <p className="text-xs text-[#AAB4C3]">Le titre reprend le nom du fichier. Garde cette page ouverte : ta vidéo s’ouvre ici dès la fin de la transcription. {MAX_TAKES} prises au plus · {MAX_STRIP_MS / 60_000} min en tout.</p>
        <div className="flex flex-wrap justify-end gap-2">
          {!imp.busy ? <button type="button" className="sv2-action px-4" onClick={onClose}>{imp.receivedId ? "Fermer" : "Annuler"}</button> : null}
          {imp.receivedId && !imp.busy ? <button type="button" className="sv2-action px-4" onClick={() => onDone(imp.receivedId!)}>Ouvrir la vidéo enregistrée</button> : null}
          {imp.receivedId && !imp.busy ? <button type="button" className="sv2-publish px-4" onClick={() => void imp.retry()}>Relancer la transcription</button> : null}
          {!imp.receivedId && files.length > 1 && !imp.busy ? <button type="button" className="sv2-publish px-4" onClick={() => void imp.start(files)}>Envoyer et commencer</button> : null}
          {!imp.receivedId && files.length === 1 && imp.error && !imp.busy ? <button type="button" className="sv2-publish px-4" onClick={() => void imp.start(files)}>Réessayer</button> : null}
        </div>
      </section>
    </div>
  );
}
