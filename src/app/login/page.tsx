import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#14130f] p-12 text-[#e9e7e1] lg:flex">
        <p className="text-lg font-semibold text-white">BeeSocial <span className="text-honey">AI</span></p>
        <div>
          <p className="font-display text-5xl leading-tight text-white">Du Reel <em className="text-honey">à la visite de club.</em></p>
          <p className="mt-4 max-w-md text-[#c9c7bf]">Le système commercial Instagram de BeeRecos : IA puissante, contrôle humain, contenu authentique, acquisition mesurable.</p>
        </div>
        <p className="text-xs text-[#a3a199]">Application interne BeeRecos</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mb-6 mt-1 text-sm text-ink-2">Un lien sécurisé t&apos;est envoyé par email. Aucun mot de passe.</p>
          <Suspense fallback={<div className="h-40" />}>
            <LoginGate />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function LoginGate() {
  await connection();
  const configured = isSupabaseConfigured();
  return (
    <>
      <LoginForm disabled={!configured} />
      {!configured ? <p className="mt-4 rounded-xl bg-honey-soft p-3 text-sm text-ink-1">La connexion sera active dès que Supabase sera configuré.</p> : null}
    </>
  );
}
