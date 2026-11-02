import { redirect } from "next/navigation";
import { Suspense } from "react";
import { legacyPublicationHref } from "@/lib/social/social-hub";

/** Anciens liens BeeMarketing (`/publication?vue=…`) : redirection vers les routes du studio des réels. */
export default function PublicationPage({ searchParams }: PageProps<"/publication">) {
  return (
    <Suspense fallback={<p role="status">Redirection…</p>}>
      <Redirect searchParams={searchParams} />
    </Suspense>
  );
}

async function Redirect({ searchParams }: { searchParams: PageProps<"/publication">["searchParams"] }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  redirect(legacyPublicationHref(params));
  return null;
}
