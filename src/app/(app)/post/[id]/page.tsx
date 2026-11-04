import type { Metadata } from "next";
import { Suspense } from "react";
import PostEditor from "@/components/post/post-editor";

export const metadata: Metadata = { title: "Éditeur de post" };

export default function PostEditorPage({ params }: PageProps<"/post/[id]">) {
  return (
    <Suspense fallback={<p role="status">Chargement du post…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/post/[id]">["params"] }) {
  const { id } = await params;
  return <PostEditor id={id} />;
}
