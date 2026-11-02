import { AUDREY_VOICE_ID } from "./audrey";
import { DEMO_STORY, type StorySpec } from "./spec";

/**
 * Les trois premiers Reels de la file (exemples du modèle), écrits uniquement à partir de VERIFIED_FACTS.
 * Ensuite, la production automatique prend le relais (generation.ts) sans brief à rédiger.
 */

const CTA = { verb: "COMMENTE", keyword: "CLUB", complement: "pour recevoir le lien de visite." };
const CAPTION_CTA = "Commente CLUB pour recevoir le lien de visite d'un club BeeRecos.";
/** Exemples sans voix off : la production en ligne n'a pas de synthèse vocale branchée (voir docs). */
const silent = (lines: Partial<StorySpec["voice"]["lines"]> = {}): StorySpec["voice"] => ({
  voiceId: AUDREY_VOICE_ID,
  lines: { hook: "", consequence: "", rupture: "", value: "", steps: "", signature: "", cta: "", ...lines },
});

export type ReelExample = { key: string; spec: StorySpec; caption: string };

export const REEL_EXAMPLES: ReelExample[] = [
  {
    key: "recommandation",
    spec: { ...DEMO_STORY, voice: silent(), cta: CTA },
    caption: `Tu recommandes un pro. Un contrat se signe. Et toi ?\n\nDans un club BeeRecos, chaque recommandation est qualifiée et le réseau te recommande aussi.\n\n${CAPTION_CTA}\n\n#BeeRecos #ClubAffaires #Recommandation #Entrepreneurs`,
  },
  {
    key: "formation",
    spec: {
      ...DEMO_STORY,
      title: "Se former et passer à l'action",
      pillar: "formation",
      card: { label: "Formation", status: "Disponible", from: "Toi", contact: "Le club", to: "Ton activité" },
      hook: { text: "TU TE\nFORMES.", complement: "Des formations actionnables." },
      consequence: { text: "TU PASSES\nÀ L'*ACTION*.", status: "Mise en pratique" },
      rupture: { text: "ET\n*APRÈS* ?" },
      value: { text: "TU AVANCES\nAVEC LE\n*CLUB*." },
      steps: {
        items: [
          { title: "APPRENDRE.", complement: "Des formations actionnables." },
          { title: "APPLIQUER.", complement: "Dans ton activité, tout de suite." },
          { title: "ÉCHANGER.", complement: "En réunion, avec le club." },
        ],
        footnote: "",
      },
      signature: { tagline: "Un réseau d'affaires digitalisé." },
      cta: CTA,
      voice: silent(),
    },
    caption: `Se former, appliquer, échanger.\n\nLes membres BeeRecos ont accès à des formations actionnables et en parlent en réunion de club.\n\n${CAPTION_CTA}\n\n#BeeRecos #Formation #Entrepreneurs #ClubAffaires`,
  },
  {
    key: "digitalisation-ia",
    spec: {
      ...DEMO_STORY,
      title: "Des outils digitaux et IA pour ton activité",
      pillar: "digitalisation_ia",
      card: { label: "Nouveau contact", status: "Ajouté", from: "Toi", contact: "Ton CRM", to: "Ton client" },
      hook: { text: "TON ACTIVITÉ\nPASSE À L'IA.", complement: "Des outils concrets." },
      consequence: { text: "TES CONTACTS\nSONT *SUIVIS*.", status: "Dans le pipeline" },
      rupture: { text: "ET\n*TOI* ?" },
      value: { text: "L'IA AU\nSERVICE DE TON\n*ACTIVITÉ*." },
      steps: {
        items: [
          { title: "CRM INTÉGRÉ.", complement: "Contacts, pipeline, recommandations." },
          { title: "TA BEECARD.", complement: "Ta vitrine publique de membre." },
          { title: "OUTILS IA.", complement: "Pour développer ton activité." },
        ],
        footnote: "",
      },
      signature: { tagline: "Un réseau d'affaires digitalisé." },
      cta: CTA,
      voice: silent(),
    },
    caption: `Un CRM intégré, une vitrine BeeCard, des outils IA : le digital au service de ton activité.\n\n${CAPTION_CTA}\n\n#BeeRecos #IA #Digitalisation #Entrepreneurs`,
  },
];
