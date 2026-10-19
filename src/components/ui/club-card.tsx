import { CalendarDays, MapPin, Users } from "lucide-react";

export function ClubCard({ name, city, nextMeeting, seatsLeft, active = true }: { name: string; city: string; nextMeeting?: string; seatsLeft?: number; active?: boolean }) {
  return (
    <article className="rounded-2xl bg-surface-1 p-4 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink-1">{name}</h3>
        {!active ? <span className="text-xs text-ink-3">Inactif</span> : null}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><MapPin aria-hidden size={14} />{city}</li>
        <li className="flex items-center gap-2"><CalendarDays aria-hidden size={14} />{nextMeeting ?? "Aucune réunion planifiée"}</li>
        {seatsLeft !== undefined ? <li className="flex items-center gap-2"><Users aria-hidden size={14} />{seatsLeft} place{seatsLeft > 1 ? "s" : ""} visiteur</li> : null}
      </ul>
    </article>
  );
}
