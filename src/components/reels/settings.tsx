"use client";
/**
 * Paramètres : marque (charte appliquée par le studio) et connexions. Les capacités affichées viennent du serveur
 * (`settings-get` de la fonction `montage`) : rien n'est annoncé disponible sans réponse réelle.
 */
import { Suspense, useEffect, useState } from "react";
import StudioSettingsPanel from "@/components/social/studio/StudioSettingsPanel";
import InstagramSettings from "@/components/post/instagram-settings";
import LinkedInSettings from "@/components/post/linkedin-settings";
import { apiUrl } from "@/lib/social/api-config";
import { isMontageConfigured, montage } from "@/lib/social/montage-api";
import { RENDER_MODE } from "@/lib/social/reel-render-client";

type Services = { transcription: boolean; claude: boolean; rendu: boolean; ressources: boolean };
const LABELS: Record<keyof Services, string> = {
  transcription: "Transcription (ElevenLabs Scribe)",
  claude: "Propositions IA (Claude : storyboard, retours, coupes)",
  rendu: "Rendu MP4 des montages filmés (HeyGen HyperFrames)",
  ressources: "Ressources de rendu (polices, logos, sons)",
};

export default function Settings() {
  const [services, setServices] = useState<Services | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isMontageConfigured) return;
    montage.getSettings().then((r) => setServices(r.services)).catch((e: Error) => setError(e.message));
  }, []);
  return (
    <div className="social-studio -mx-4 space-y-4 px-4 py-2 sm:-mx-8 sm:px-8">
      <header>
        <p className="kicker">Instagram BeeRecos</p>
        <h1 className="font-display text-3xl font-semibold">Paramètres</h1>
      </header>
      <section className="card p-4" aria-labelledby="connexions">
        <h2 id="connexions" className="font-semibold">Connexions et capacités</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>Serveur BeeMarketing (Edge Functions, base partagée)</dt><dd>{apiUrl ? "configuré" : "non configuré"}</dd></div>
          {error ? <p role="alert" className="text-red-700">Capacités illisibles : {error}</p> : null}
          {isMontageConfigured && !services && !error ? <p role="status" className="text-mut">Lecture des capacités…</p> : null}
          {services ? (Object.keys(LABELS) as (keyof Services)[]).map((k) => (
            <div key={k} className="flex justify-between gap-4"><dt>{LABELS[k]}</dt><dd className={services[k] ? "text-acid-dim" : "text-red-700"}>{services[k] ? "disponible" : "non configuré"}</dd></div>
          )) : null}
          <div className="flex justify-between gap-4"><dt>Narration et rendu des vidéos IA</dt><dd>{RENDER_MODE === "online" ? "en ligne (fonction studio-render, vérifiée au lancement)" : "serveur de rendu local (NEXT_PUBLIC_REEL_RENDER_URL)"}</dd></div>
          <div className="flex justify-between gap-4"><dt>Génération de plans vidéo par un fournisseur externe (Veo, Runway…)</dt><dd className="text-mut">non raccordée</dd></div>
        </dl>
      </section>
      <InstagramSettings />
      <Suspense fallback={null}><LinkedInSettings /></Suspense>
      <section className="card p-4" aria-labelledby="marque">
        <h2 id="marque" className="font-semibold">Marque</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>BeeRecos (B et R majuscules), bleu #2851FF, base blanc / noir / bleu, textes en Poppins, logo officiel jamais retapé.</li>
          <li>Baseline #MonReseauCestTonReseau, entièrement bleue, manuscrite ; carte de fin d&apos;environ 2 s, une seule fois.</li>
          <li>Piliers : réseau d&apos;apporteurs d&apos;affaires · École de formation BeeSchool · Digitalisation IA.</li>
        </ul>
        <div className="mt-4"><StudioSettingsPanel /></div>
      </section>
    </div>
  );
}
