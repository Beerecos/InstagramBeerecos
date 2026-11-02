/**
 * Calendrier éditorial récurrent, calculé CÔTÉ SERVEUR en Europe/Paris (heure d'été / d'hiver comprises).
 * Par défaut : trois Reels par semaine, lundi, mercredi et vendredi à 18 h 00.
 */

export type SlotRule = { days: number[]; time: string; tz: "Europe/Paris" };
export const DEFAULT_SLOTS: SlotRule = { days: [1, 3, 5], time: "18:00", tz: "Europe/Paris" };
export const DAY_LABEL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Décalage (minutes) de Europe/Paris par rapport à UTC à l'instant donné. */
export function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((local - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Instant UTC correspondant à une date et une heure locales de Paris. */
export function parisToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const off1 = parisOffsetMinutes(new Date(guess.getTime() - parisOffsetMinutes(guess) * 60000));
  return new Date(guess.getTime() - off1 * 60000);
}

/** Date locale de Paris (année, mois, jour, jour de semaine) d'un instant. */
export function parisDate(at: Date): { y: number; m: number; d: number; weekday: number } {
  const local = new Date(at.getTime() + parisOffsetMinutes(at) * 60000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), weekday: local.getUTCDay() };
}

export function validateSlotRule(input: unknown): { ok: true; rule: SlotRule } | { ok: false; error: string } {
  const o = (input ?? {}) as Record<string, unknown>;
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
  const time = typeof o.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time) ? o.time : null;
  if (!days.length) return { ok: false, error: "Choisis au moins un jour de publication." };
  if (days.length > 7) return { ok: false, error: "Sept jours au plus." };
  if (!time) return { ok: false, error: "Heure au format HH:MM (Europe/Paris)." };
  return { ok: true, rule: { days, time, tz: "Europe/Paris" } };
}

/** Prochains créneaux (UTC) à partir de `from`, sur `horizonDays` jours. */
export function upcomingSlots(rule: SlotRule, from: Date, horizonDays = 14): Date[] {
  const [hh, mm] = rule.time.split(":").map(Number);
  const out: Date[] = [];
  const start = parisDate(from);
  for (let i = 0; i <= horizonDays; i++) {
    const base = new Date(Date.UTC(start.y, start.m - 1, start.d + i, 12));
    const wd = base.getUTCDay();
    if (!rule.days.includes(wd)) continue;
    const slot = parisToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hh, mm);
    if (slot.getTime() > from.getTime()) out.push(slot);
  }
  return out;
}

/** Libellé lisible d'un créneau, en heure de Paris. */
export function formatParis(at: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}
