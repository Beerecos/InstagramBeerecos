"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const schema = z.object({ email: z.email("Adresse email invalide.") });

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Application interne : pas d'inscription libre, les comptes sont créés par un administrateur.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  });
  // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
  if (error && error.status !== 400 && error.status !== 422) {
    return { status: "error", message: "Envoi impossible pour le moment. Réessaie dans un instant." };
  }
  return { status: "sent", message: "Si ce compte existe, un lien de connexion vient d'être envoyé." };
}
