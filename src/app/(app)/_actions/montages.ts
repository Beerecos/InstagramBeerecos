"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyCut, createMontage, markUploaded, transcribeMontage, undoCut } from "@/server/montages/service";

export type MontageActionResult = { error?: string };

const id = z.string().uuid();
const message = (e: unknown) => (e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Action impossible.");

async function run(montageId: unknown, fn: (id: string) => Promise<void>): Promise<MontageActionResult> {
  try {
    const checked = id.parse(montageId);
    await fn(checked);
    revalidatePath(`/montage/${checked}`);
    revalidatePath("/montage");
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

/** Étape 1 de l'envoi : crée le montage et renvoie l'URL d'envoi signée. */
export async function createMontageAction(input: { title: string; fileName: string; size: number }): Promise<{ id: string; path: string; token: string } | { error: string }> {
  try {
    return await createMontage(input);
  } catch (e) {
    return { error: message(e) };
  }
}

/** Étape 2 de l'envoi : la prise est stockée, on enregistre sa durée et ses îlots de parole. */
export async function markUploadedAction(montageId: string, input: { durationMs: number; islands: { fromMs: number; toMs: number }[] | null }) {
  return run(montageId, (m) => markUploaded(m, input));
}

export async function transcribeMontageAction(montageId: string) {
  return run(montageId, transcribeMontage);
}

export async function applyCutAction(montageId: string, drop: number[]) {
  return run(montageId, (m) => applyCut(m, z.array(z.number().int().positive()).max(500).parse(drop)));
}

export async function undoCutAction(montageId: string) {
  return run(montageId, undoCut);
}
