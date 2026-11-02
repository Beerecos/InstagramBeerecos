"use client";
import { useEffect, useState, type ReactNode } from "react";
import { restoreVisual } from "@/components/social/visual-project";
import { useSearchParams } from "@/components/social/router";
import { supabase } from "@/lib/social/supabase";
import { getPublication, type SocialPublicationRow } from "@/lib/social/api";
import { type Carousel } from "@/domain/social/carousel";


export type VisualProjectState = { id: string; storageKey: string; initial?: Carousel; version?: string; initialTemplate?: SocialPublicationRow; context?: { workspaceId: string | null; eventId: string | null; contactId: string | null } };
/** Per-account and per-project local recovery; an URL without ?visual starts a new project.
 * A different browser retrieves the authorized server composition, never another local draft. */
export default function VisualProject({ children, mode = "visual" }: { mode?: "visual" | "templates"; children: (project: VisualProjectState) => ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [newId] = useState(() => crypto.randomUUID());
  const id = params.get("visual") || newId;
  const workspace = params.get("workspaceId") || params.get("wsid") || "national";
  const [actor, setActor] = useState<string | null>(supabase ? null : "offline");
  const [project, setProject] = useState<VisualProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setActor(data.session?.user.id ?? null); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setActor(session?.user.id ?? null); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!actor) return;
    let alive = true;
    setProject(null); setError(null);
    const storageKey = `beerecos.visual.v2.${actor}.${workspace}.${id}`;
    const base = { id, storageKey, context: { workspaceId: workspace === "national" ? null : workspace, eventId: params.get("eventId"), contactId: params.get("contactId") } };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (mode === "visual" && cached.template_key) {
          const next = new URLSearchParams(window.location.search); next.delete("vue"); next.set("tab", "studio"); next.set("templates", "1"); setParams(next, { replace: true });
        } else if (mode === "templates" && !cached.template_key) {
          const next = new URLSearchParams(window.location.search); next.delete("tab"); next.delete("templates"); next.set("vue", "carrousels"); setParams(next, { replace: true });
        } else setProject(mode === "templates" ? { ...base, initialTemplate: cached as SocialPublicationRow, version: cached.updated_at } : { ...base, initial: restoreVisual(cached), version: cached.serverVersion, context: cached.sourceContext ?? base.context });
      } else if (id === newId) {
        setProject(base);
      } else {
        getPublication(id).then((row) => {
          if (!alive) return;
          if (mode === "visual" && row.template_key !== "visual") {
            const next = new URLSearchParams(window.location.search);
            next.delete("vue"); next.set("tab", "studio"); next.set("templates", "1"); setParams(next, { replace: true });
            return;
          }
          if (mode === "templates" && row.template_key === "visual") {
            const next = new URLSearchParams(window.location.search); next.delete("tab"); next.delete("templates"); next.set("vue", "carrousels"); setParams(next, { replace: true });
            return;
          }
          if (row.template_key !== "visual" && !["club_event", "why_join", "club_life", "special_event", "member_spotlight"].includes(row.template_key)) throw new Error("Modèle historique non pris en charge.");
          setProject(mode === "templates" ? { ...base, initialTemplate: row, version: row.updated_at } : { ...base, initial: restoreVisual(row.composition), version: row.updated_at, context: { workspaceId: row.workspace_id, eventId: row.event_id, contactId: row.contact_id } });
        }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Composition inaccessible."); });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Brouillon local illisible."); }
    return () => { alive = false; };
  }, [actor, workspace, id, newId, mode, setParams, params]);
  useEffect(() => {
    if (!params.has("visual") && project) {
      const next = new URLSearchParams(params); next.delete("postChannel"); next.set("visual", id); setParams(next, { replace: true });
    }
  }, [params, project, id, setParams]);
  if (error) return <p role="alert" className="p-4 text-red-700">{error} La composition n’a pas été remplacée.</p>;
  if (!actor || !project || !project.storageKey.startsWith(`beerecos.visual.v2.${actor}.`) || project.id !== id) return <p role="status" className="p-4 text-mut">{actor ? "Chargement de la composition…" : "Connexion requise pour retrouver tes visuels."}</p>;
  return children(project);
}
