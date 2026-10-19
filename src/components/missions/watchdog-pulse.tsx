"use client";

import { useEffect } from "react";

/** Tant que l'application est ouverte, déclenche périodiquement la tournée du Chien de garde (le serveur limite la fréquence). */
export function WatchdogPulse({ intervalMs = 3 * 60_000 }: { intervalMs?: number }) {
  useEffect(() => {
    const pulse = () => {
      if (document.visibilityState === "visible") fetch("/api/watchdog/pulse", { method: "POST" }).catch(() => {});
    };
    const first = setTimeout(pulse, 5_000);
    const id = setInterval(pulse, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return null;
}
