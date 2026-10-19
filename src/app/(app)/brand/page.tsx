import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui";
import { can } from "@/domain/roles";
import { getBrand } from "@/server/missions/queries";
import { BrandForm } from "./brand-form";

export const metadata: Metadata = { title: "Marque" };

const COLORS = [["Vibrant blue", "#2851FF"], ["White", "#FFFFFF"], ["Black", "#000000"], ["Purple pop", "#693BFC"], ["Fresh green", "#3BCAC2"]] as const;

export default function BrandPage() {
  return (
    <>
      <PageHeader eyebrow="Marque" title="Mémoire de marque" description="Ce que chaque agent sait de BeeRecos avant d'écrire une ligne." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Identité visuelle" description="Charte BeeRecos, octobre 2026. Logo officiel, jamais modifié." />
          <div className="flex flex-wrap items-center gap-8">
            <Image src="/brand/beemarketing-logo.png" alt="Logo BeeMarketing" width={220} height={49} />
            <div className="flex flex-wrap gap-3">
              {COLORS.map(([n, hex]) => (
                <div key={hex} className="text-xs text-ink-2">
                  <span className="mb-1 block size-12 rounded-xl ring-1 ring-line" style={{ background: hex }} />
                  {n}<br /><code className="text-ink-3">{hex}</code>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-2">Typographie : <span className="font-semibold">Poppins</span> (Thin, Regular, SemiBold, Bold)</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Entreprise, cibles, ton et règles" />
          <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
            <BrandData />
          </Suspense>
        </Card>
      </div>
    </>
  );
}

async function BrandData() {
  const { memory, user } = await getBrand();
  return <BrandForm memory={memory} editable={can(user.role, "settings:manage")} />;
}
