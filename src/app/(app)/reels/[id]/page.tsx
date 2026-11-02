import type { Metadata } from "next";
import { Suspense } from "react";
import ReelWorkspace from "@/components/reels/reel-workspace";

export const metadata: Metadata = { title: "Studio" };

export default function ReelStudioPage({ params }: PageProps<"/reels/[id]">) {
  return (
    <Suspense fallback={<p role="status">Chargement du projet…</p>}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }: { params: PageProps<"/reels/[id]">["params"] }) {
  const { id } = await params;
  return <ReelWorkspace montageId={id} />;
}
