import type { Metadata } from "next";
import { Suspense } from "react";
import PostEditor from "@/components/post/post-editor";

export const metadata: Metadata = { title: "Nouveau post" };

/** `?format=carrousel` (2 à 10 photos) ou `?format=simple` (une photo, par défaut). */
export default function NewPostPage({ searchParams }: PageProps<"/post/nouveau">) {
  return (
    <Suspense fallback={<p role="status">Chargement…</p>}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ searchParams }: { searchParams: PageProps<"/post/nouveau">["searchParams"] }) {
  const { format } = await searchParams;
  return <PostEditor id={null} initialFormat={format === "carrousel" ? "carrousel" : "simple"} />;
}
