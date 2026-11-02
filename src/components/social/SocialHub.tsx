"use client";
/**
 * Hub réseaux sociaux repris de BeeMarketing (`src/pages/SocialHub.tsx`), route `/publication` conservée pour que
 * les liens internes des écrans fonctionnent tels quels. Portés : parcours (liste + calendrier), pilote automatique
 * Instagram, montage, Reels IA, carrousels. Les autres vues de BeeMarketing (préparer un post, studio visuel,
 * comptes, automatisation, campagnes, validations, La Ruche) ne sont pas encore portées : un message l'indique.
 */
import { lazy, Suspense, useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "@/components/social/router";
import { resolveSocialView, withoutEditor, withoutTool, type SocialToolKey } from "@/lib/social/social-hub";

const SocialWorkspace = lazy(() => import("@/components/social/SocialWorkspace"));
const InstagramPilot = lazy(() => import("@/components/social/InstagramPilot"));
const CarouselStudio = lazy(() => import("@/components/social/CarouselStudio"));
const MontageStudio = lazy(() => import("@/components/social/MontageStudio"));

function NOT_PORTED(label: string) {
  return function NotPortedTool() { return <NotPorted label={label} />; };
}

const TOOL: Record<SocialToolKey, () => ReactElement> = {
  pilotage: () => <InstagramPilot />,
  montage: () => <MontageStudio source="reel" />,
  reels: () => <MontageStudio source="ai" />,
  carrousels: () => <CarouselStudio />,
  campagnes: NOT_PORTED("Campagnes à partager"),
  automatisation: NOT_PORTED("Automatisation et conversations"),
  validations: NOT_PORTED("Autres validations"),
  ruche: NOT_PORTED("La Ruche de BeeMarketing"),
};

function NotPorted({ label }: { label: string }) {
  return <section className="rounded-xl border border-line bg-white p-5">
    <h1 className="font-display text-2xl">{label}</h1>
    <p className="mt-2 text-sm text-mut">Cet écran n&apos;est pas encore transféré depuis BeeMarketing : utilise-le dans BeeMarketing pour l&apos;instant. Les données sont les mêmes (base partagée).</p>
  </section>;
}

const loading = <p role="status" className="px-5 py-6 text-sm text-mut">Chargement…</p>;

export default function SocialHub() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const view = resolveSocialView(params);
  const editorOpen = view.kind === "workspace" && view.editor;
  const panelOpen = editorOpen || view.kind === "tool";
  // À la fermeture d'un panneau, la liste et les compteurs se rechargent (un enregistrement a pu avoir lieu).
  const [refreshKey, setRefreshKey] = useState(0);
  const wasOpen = useRef(panelOpen);
  const boardScroll = useRef(0);
  const focusRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (panelOpen) { boardScroll.current = window.scrollY; window.scrollTo(0, 0); focusRoot.current?.focus(); }
    else window.scrollTo(0, boardScroll.current);
  }, [panelOpen]);
  useEffect(() => { if (wasOpen.current && !panelOpen) setRefreshKey((n) => n + 1); wasOpen.current = panelOpen; }, [panelOpen]);
  const go = (next: URLSearchParams) => navigate(`/publication${next.size ? `?${next}` : ""}`);

  const tab = params.get("tab");
  const drawerTitle = tab === "studio" ? "Studio visuel" : tab === "parametres" ? "Comptes" : params.has("edit") ? "Préparer le post" : "Créer un contenu";
  return <div className={`social-studio min-h-full${panelOpen ? " social-studio-focus" : ""}`}>
    <div hidden={panelOpen}><Suspense fallback={loading}><SocialWorkspace display={view.kind === "workspace" ? view.display : "list"} reviewFocus={view.kind === "workspace" && view.reviewFocus} refreshKey={refreshKey} /></Suspense></div>
    {panelOpen && <main ref={focusRoot} tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
      <button type="button" className="mb-5 min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-medium" onClick={() => go(view.kind === "tool" ? withoutTool(params) : withoutEditor(params))}>← Revenir au parcours</button>
      <p className="mb-3 text-xs text-mut">Créer → Préparer le post → Valider</p>
      <Suspense fallback={loading}>{view.kind === "tool" ? TOOL[view.tool]() : <NotPorted label={drawerTitle} />}</Suspense>
    </main>}
  </div>;
}
