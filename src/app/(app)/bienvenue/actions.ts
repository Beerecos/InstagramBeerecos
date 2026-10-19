"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/dal";

export type OnboardingState = { message?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(120),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Identifiant : minuscules, chiffres et tirets."),
});

export async function createOrganization(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  if (isDemoMode()) return { message: "Indisponible en mode démo." };
  const user = await getCurrentUser();
  if (user.organization) redirect("/");
  const parsed = schema.safeParse({ name: form.get("name"), slug: form.get("slug") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) return { message: error.code === "23505" ? "Cet identifiant est déjà utilisé." : "Création impossible." };
  redirect("/");
}
