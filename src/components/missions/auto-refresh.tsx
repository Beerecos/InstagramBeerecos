"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit la vue tant que des agents travaillent (l'état affiché vient toujours du serveur). */
export function AutoRefresh({ active, intervalMs = 2500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
