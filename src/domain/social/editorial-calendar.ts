/** Editorial dates use the browser's displayed time zone, never a UTC slice. */
export type CalendarView = "week" | "month";

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${localDayKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function plannedDateIso(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choisis une date et une heure valides.");
  const date = new Date(value);
  // Reject impossible dates, including the missing hour at the spring DST change.
  if (Number.isNaN(date.getTime()) || localDateTime(date.toISOString()) !== value) {
    throw new Error("Cette heure n'existe pas dans ce fuseau. Choisis une autre heure.");
  }
  return date.toISOString();
}

export function calendarRange(anchor: string, view: CalendarView): { days: Date[]; from: string; to: string } {
  const date = new Date(`${anchor}T12:00:00`);
  if (Number.isNaN(date.getTime()) || localDayKey(date) !== anchor) throw new Error("Date invalide.");
  const start = new Date(date.getFullYear(), date.getMonth(), view === "month" ? 1 : date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = view === "month"
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  if (view === "month" && end.getDay() !== 1) end.setDate(end.getDate() + (8 - end.getDay()) % 7);
  const days: Date[] = [];
  for (const day = new Date(start); day < end; day.setDate(day.getDate() + 1)) days.push(new Date(day));
  return { days, from: start.toISOString(), to: end.toISOString() };
}

export function shiftCalendar(anchor: string, view: CalendarView, direction: number): string {
  const date = new Date(`${anchor}T12:00:00`);
  if (view === "month") { date.setDate(1); date.setMonth(date.getMonth() + direction); }
  else date.setDate(date.getDate() + 7 * direction);
  return localDayKey(date);
}

export function editorialHref(context: { id?: string; campaignId?: string | null; workspaceId?: string | null; day?: string }): string {
  const params = new URLSearchParams();
  if (context.id) params.set("edit", context.id);
  if (context.campaignId) params.set("campaignId", context.campaignId);
  if (context.workspaceId) params.set("workspaceId", context.workspaceId);
  if (context.day) params.set("date", context.day);
  return `/publication${params.size ? `?${params}` : ""}`;
}
