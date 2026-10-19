import Link from "next/link";
import { getNotifications } from "@/server/missions/queries";
import { currentAutonomyMode, engineStatus } from "@/server/missions/service";

const MODE_LABEL = { manual: "Manuel", validation: "Semi-automatique", autopilot: "Automatique" } as const;
import { NotificationBell } from "./notification-bell";

/** État réel : connexion du modèle des agents et notifications issues des tâches et validations. */
export async function TopBar() {
  const [items, engine, mode] = await Promise.all([getNotifications(), Promise.resolve(engineStatus()), currentAutonomyMode()]);
  return (
    <div className="flex items-center justify-end gap-2">
      <Link href="/settings/integrations" className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-line hover:bg-surface-2 sm:flex">
        <span aria-hidden className={engine.llm ? "size-2 rounded-full bg-status-good" : "size-2 rounded-full bg-status-warning"} />
        {engine.llm ? "Équipe IA connectée" : "Claude à connecter"}
      </Link>
      <Link href="/settings" className="rounded-full px-3 py-1.5 text-xs ring-1 ring-line hover:bg-surface-2" title="Niveau de validation des actions">
        Mode : <span className="font-medium">{MODE_LABEL[mode]}</span>
      </Link>
      <NotificationBell items={items} />
    </div>
  );
}
