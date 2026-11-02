import { useRef, useState } from "react";
import * as api from "@/lib/social/api";

export type VisualMedia = { assetId: string; storagePath: string | null; url: string | null; type: "image"; alt: string; slideId?: string };
type SaveAttempt = { request: api.SavePublicationInput; fingerprint: string };
type SavedVisual = { id: string; version?: string; fingerprint?: string; attempt?: SaveAttempt };

// JSONB object key order is not significant; visual array order is significant.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
}

function matchesSaved(row: api.SocialPublicationRow, request: api.SavePublicationInput): boolean {
  return row.id === request.id && canonical({
    templateKey: row.template_key, channel: row.channel, workspaceId: row.workspace_id,
    eventId: row.event_id, contactId: row.contact_id, title: row.title, composition: row.composition,
    caption: row.caption, cta: row.cta, hashtags: row.hashtags, link: row.link, ratios: row.ratios,
    missing: row.missing, status: row.status,
  }) === canonical({
    templateKey: request.templateKey, channel: request.channel ?? "instagram", workspaceId: request.workspaceId ?? null,
    eventId: request.eventId ?? null, contactId: request.contactId ?? null, title: String(request.title ?? request.templateKey).slice(0, 300),
    composition: request.composition, caption: request.caption ?? null, cta: request.cta ?? null,
    hashtags: (request.hashtags ?? []).map(String).slice(0, 60), link: request.link ?? null, ratios: (request.ratios ?? ["4:5"]).map(String).slice(0, 10),
    missing: (request.missing ?? []).map(String).slice(0, 100), status: request.status === "genere" ? "genere" : "brouillon",
  });
}

/** Shared by both visual editors. The UUID survives a failed first save; the server must
 * upsert it with expectedVersion and reuse social_publications.deliverable_id on transfer.
 * composition.media contains real uploaded renders in composition.slides order. */
export function useVisualTransfer(key: string, sourceId?: string, initialVersion?: string) {
  const storageKey = `beerecos.visual-source.v1.${key}`;
  const source = useRef<SavedVisual | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function remember(saved: SavedVisual) {
    // Persist first: a quota error must never leave an unrepeatable write in flight.
    localStorage.setItem(storageKey, JSON.stringify(saved));
    source.current = saved;
  }

  function accept(saved: api.SocialPublicationRow, attempt: SaveAttempt) {
    if (saved.id !== source.current?.id) throw new Error("Le serveur doit prendre en charge la sauvegarde visuelle idempotente avant ce transfert.");
    if (!matchesSaved(saved, attempt.request)) throw new Error("Le serveur a retourné une composition différente. Rechargez sa version avant de continuer.");
    remember({ id: saved.id, version: saved.updated_at, fingerprint: attempt.fingerprint });
  }

  async function saveAttempt(attempt: SaveAttempt) {
    let saved: api.SocialPublicationRow;
    try { saved = await api.savePublication(attempt.request); }
    catch (error) {
      // The write may have committed even when its HTTP response was lost.
      const recovered = await api.getPublication(attempt.request.id!).catch(() => null);
      if (!recovered || !matchesSaved(recovered, attempt.request)) throw error;
      saved = recovered;
    }
    accept(saved, attempt);
  }

  async function recoverAttempt(attempt: SaveAttempt) {
    const row = await api.getPublication(attempt.request.id!).catch(() => null);
    if (row && matchesSaved(row, attempt.request)) { accept(row, attempt); return; }
    if (row && row.updated_at !== attempt.request.expectedVersion) {
      throw new Error("La composition a été modifiée sur le serveur. Rechargez sa version avant de réessayer ; vos modifications locales sont conservées.");
    }
    // If the read is unavailable, replay ONLY the original request/version. The server
    // must enforce create-if-absent / compare-and-swap; never adopt an unverified version.
    await saveAttempt(attempt);
  }

  async function send(input: api.SavePublicationInput, render: () => Promise<VisualMedia[]>, open: (id: string) => void, channel?: "instagram" | "linkedin") {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice("Composition et enregistrement des visuels…");
    try {
      if (!source.current) {
        const raw = localStorage.getItem(storageKey);
        const saved = raw ? JSON.parse(raw) as SavedVisual : null;
        source.current = saved?.id ? saved : { id: sourceId ?? crypto.randomUUID(), version: initialVersion };
        // Fail before a server write if we cannot preserve the retry identity.
        localStorage.setItem(storageKey, JSON.stringify(source.current));
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
      const fingerprint = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      if (source.current.attempt) await recoverAttempt(source.current.attempt);
      if (source.current.fingerprint !== fingerprint || !source.current.version) {
        const media = await render();
        if (!media.length || media.some((m) => !m.assetId || !m.storagePath)) throw new Error("Les images finales ne sont pas encore enregistrées. Réessayez.");
        const request = { ...input, id: source.current.id, expectedVersion: source.current.version,
          composition: { ...(input.composition as Record<string, unknown>), media }, status: "brouillon" as const };
        const attempt = { request, fingerprint };
        remember({ ...source.current, attempt });
        await saveAttempt(attempt);
      }
      setNotice("Composition enregistrée sur le serveur. Ouverture du post…");
      const result = await api.transferStudioMedia({ sourceType: "visual", sourceId: source.current.id, expectedSourceVersion: source.current.version!, ...(channel ? { channel } : {}) });
      if (channel && result.channel !== channel) throw new Error("Le serveur n’a pas confirmé le canal demandé. Le post n’a pas été ouvert.");
      if (!result.id) throw new Error("Le serveur n’a pas retourné de brouillon. Réessayez.");
      if (result.studioSource?.sourceVersion) {
        source.current.version = result.studioSource.sourceVersion;
        localStorage.setItem(storageKey, JSON.stringify(source.current));
      }
      setNotice("Brouillon enregistré sur le serveur. Aucune publication ni programmation.");
      open(result.id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Transfert impossible. Votre composition est conservée.");
    } finally { pending.current = false; setBusy(false); }
  }
  return { send, busy, notice };
}
