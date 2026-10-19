import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env/server";
import { Logo } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Formes additionnelles autorisées par la charte : cercles en trait fin, en ponctuation. */}
        <svg aria-hidden className="pointer-events-none absolute -right-40 -top-24 h-[44rem] w-[44rem] text-white/45" viewBox="0 0 700 700" fill="none">
          <circle cx="430" cy="300" r="300" stroke="currentColor" strokeWidth="1" />
          <circle cx="560" cy="120" r="170" stroke="currentColor" strokeWidth="1" />
        </svg>
        <Logo variant="white" width={210} priority />
        <div className="relative">
          <p className="text-5xl font-light leading-[1.1] tracking-tight">Du Reel<br /><span className="font-semibold">à la visite de club.</span></p>
          <p className="mt-6 max-w-md text-white/80">Le système commercial Instagram de BeeRecos : IA puissante, contrôle humain, contenu authentique, acquisition mesurable.</p>
        </div>
        <p className="relative text-xs uppercase tracking-[0.18em] text-white/70">Application interne BeeRecos</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo width={180} /></div>
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
      {!configured ? <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-ink-1">La connexion sera active dès que Supabase sera configuré.</p> : null}
    </>
  );
}
