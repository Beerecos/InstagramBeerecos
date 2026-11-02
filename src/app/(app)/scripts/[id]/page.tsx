import type { Metadata } from "next";
import { Suspense } from "react";
import ScriptEditor from "@/components/reels/script-editor";

export const metadata: Metadata = { title: "Script" };

export default function ScriptPage({ params }: PageProps<"/scripts/[id]">) {
  return (
    <Suspense fallback={<p role="status">Chargement du script…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/scripts/[id]">["params"] }) {
  const { id } = await params;
  return <ScriptEditor assetId={id} />;
}
