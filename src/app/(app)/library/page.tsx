import type { Metadata } from "next";
import Library from "@/components/reels/library";

export const metadata: Metadata = { title: "Bibliothèque" };

export default function LibraryPage() {
  return <Library />;
}
