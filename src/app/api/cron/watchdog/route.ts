import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { runWatchdogAllOrganizations } from "@/server/missions/service";

/** Tournée planifiée du Watchdog (Vercel Cron, voir vercel.json). Protégée par CRON_SECRET. */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const organizations = await runWatchdogAllOrganizations();
  return NextResponse.json({ ok: true, organizations });
}
