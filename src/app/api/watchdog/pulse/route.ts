import { NextResponse } from "next/server";
import { ForbiddenError } from "@/server/auth/dal";
import { runWatchdogNow } from "@/server/missions/service";

/** Impulsion envoyée par l'interface ouverte : tournée du Watchdog au plus toutes les 3 minutes par organisation. */
export async function POST() {
  try {
    return NextResponse.json(await runWatchdogNow());
  } catch (e) {
    const status = e instanceof ForbiddenError ? 403 : 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status });
  }
}
