"use client";
/**
 * Accueil d'Instagram BeeRecos : ouvre directement le studio sur le dernier projet modifié ; le choix du projet se
 * fait dans la barre du studio. Sans projet (ou serveur non configuré), affiche « Mes réels » pour en créer un.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MyReels from "@/components/reels/my-reels";
import { isMontageConfigured, montage } from "@/lib/social/montage-api";

export default function StudioHome() {
  const router = useRouter();
  const [empty, setEmpty] = useState(!isMontageConfigured);
  useEffect(() => {
    if (!isMontageConfigured) return;
    let alive = true;
    montage.list().then((r) => {
      const latest = r.montages.filter((m) => !m.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!alive) return;
      if (latest) router.replace(`/reels/${latest.id}`); else setEmpty(true);
    }).catch(() => { if (alive) setEmpty(true); });
    return () => { alive = false; };
  }, [router]);
  return empty ? <MyReels /> : <p role="status" className="p-6 text-sm text-ink-2">Ouverture du studio…</p>;
}
