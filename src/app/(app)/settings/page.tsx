import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gauge, Palette, Plug, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Paramètres" };

const SECTIONS = [
  { href: "/settings/integrations", icon: Plug, title: "Intégrations", text: "Instagram, LinkedIn, Claude, Veo, Runway, Google Drive, Supabase.", ready: true },
  { href: "/settings", icon: Gauge, title: "Autonomie & budgets", text: "Manuel, Validation ou Pilote automatique (désactivé par défaut), limites et budgets IA.", ready: false },
  { href: "/brand", icon: Palette, title: "Marque", text: "Mémoire de marque, charte et logos officiels.", ready: true },
  { href: "/settings", icon: Users, title: "Équipe & rôles", text: "Administrateur, responsable contenu, responsable de club, commercial, lecteur.", ready: false },
  { href: "/conversations", icon: Users, title: "Conversations", text: "Messagerie des DM Instagram (phase ventes).", ready: true },
  { href: "/clubs", icon: Users, title: "Clubs", text: "Clubs et réunions BeeRecos.", ready: true },
  { href: "/systeme", icon: Gauge, title: "Système / Journal", text: "Journal d'audit et exécutions.", ready: true },
  { href: "/settings", icon: ShieldCheck, title: "RGPD", text: "Durées de conservation, consentements, export et suppression.", ready: false },
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Paramètres" title="Paramètres" />
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface-1 ring-1 ring-line">
        {SECTIONS.map(({ href, icon: Icon, title, text, ready }) => (
          <li key={title}>
            <Link href={href} aria-disabled={!ready} className={ready ? "flex items-center gap-4 p-4 hover:bg-surface-2" : "pointer-events-none flex items-center gap-4 p-4 opacity-60"}>
              <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-ink-1"><Icon size={18} /></span>
              <span className="flex-1">
                <span className="block font-medium text-ink-1">{title}{ready ? null : <span className="ml-2 text-xs font-normal text-ink-3">bientôt</span>}</span>
                <span className="block text-sm text-ink-2">{text}</span>
              </span>
              <ChevronRight aria-hidden size={18} className="text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
