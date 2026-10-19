import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Sparkles, Video } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Créer" };

const MODES = [
  {
    key: "ai",
    icon: Bot,
    title: "Créer avec l'IA",
    text: "Décris ton idée en une phrase. Claude écrit le hook, le script, le storyboard, génère les scènes et monte le Reel.",
    example: "« Un Reel de 30 s sur pourquoi un réseau professionnel doit être monétisé. »",
  },
  {
    key: "human",
    icon: Video,
    title: "Utiliser ma vidéo",
    text: "Dépose une vidéo tournée (studio, interview, réunion, témoignage). Claude repère les meilleurs passages et en fait plusieurs Reels.",
    example: "« Ma vidéo de 12 min → 5 Reels proposés avec leur score. »",
  },
  {
    key: "hybrid",
    icon: Sparkles,
    title: "Créer une vidéo hybride",
    text: "Ta vraie présence face caméra, enrichie d'animations, de chiffres, de B-roll et d'écrans générés quand tu cites une preuve.",
    example: "« Authenticité humaine + puissance de production IA. »",
  },
] as const;

export default function CreatePage() {
  return (
    <>
      <PageHeader eyebrow="Créer" title="Comment veux-tu créer ?" description="Choisis un point de départ. Claude déduit le reste : pilier, format, durée, CTA." />
      <div className="grid gap-4 md:grid-cols-3">
        {MODES.map(({ key, icon: Icon, title, text, example }) => (
          <Link key={key} href={`/creer/${key}`} className="group flex flex-col rounded-[1.75rem] bg-surface-1 p-6 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-ink-3">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-brand text-honey"><Icon size={24} /></span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink-1">{title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{text}</p>
            <p className="mt-4 text-sm italic text-ink-3">{example}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-ink-1">
              Commencer <ArrowRight aria-hidden size={16} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
