"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeWeights } from "@/domain/content";
import { DEFAULT_BRAND_MEMORY } from "@/domain/missions/brand-defaults";
import { createMissionFromRequest, decideApproval, resumeMission, runWatchdogNow, saveBrandMemory, type ApprovalAction } from "@/server/missions/service";

export type ActionState = { error?: string; ok?: boolean };

const requestSchema = z.string().trim().min(5, "Décrivez votre objectif en quelques mots.").max(4000);

export async function createMissionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = requestSchema.safeParse(form.get("request"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let id: string;
  try {
    id = (await createMissionFromRequest(parsed.data)).id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Création impossible." };
  }
  redirect(`/missions/${id}`);
}

export async function resumeMissionAction(missionId: string): Promise<void> {
  await resumeMission(missionId);
  revalidatePath(`/missions/${missionId}`);
}

export async function runWatchdogAction(): Promise<void> {
  await runWatchdogNow({ force: true });
  revalidatePath("/watchdog");
}

export async function decideApprovalAction(approvalId: string, action: ApprovalAction, form: FormData): Promise<void> {
  const comment = String(form.get("comment") ?? "").trim().slice(0, 2000) || null;
  await decideApproval(approvalId, action, comment);
  revalidatePath("/approvals");
  revalidatePath("/missions", "layout");
}

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const num = (v: FormDataEntryValue | null) => Math.max(0, Math.min(100, Number(v) || 0));

export async function saveBrandAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await saveBrandMemory({
      ...DEFAULT_BRAND_MEMORY,
      company: String(form.get("company") ?? "").trim() || DEFAULT_BRAND_MEMORY.company,
      description: String(form.get("description") ?? "").trim(),
      positioning: String(form.get("positioning") ?? "").trim(),
      tone: String(form.get("tone") ?? "").trim(),
      targets: lines(form.get("targets")),
      offers: lines(form.get("offers")),
      allowedWords: lines(form.get("allowedWords")),
      forbiddenWords: lines(form.get("forbiddenWords")),
      ctas: lines(form.get("ctas")),
      references: lines(form.get("references")),
      pillarWeights: normalizeWeights({ reseau_monetise: num(form.get("w_reseau")), formation: num(form.get("w_formation")), digitalisation_ia: num(form.get("w_ia")) }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
  revalidatePath("/brand");
  return { ok: true };
}
