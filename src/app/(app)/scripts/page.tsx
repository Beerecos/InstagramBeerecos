import type { Metadata } from "next";
import Scripts from "@/components/reels/scripts";

export const metadata: Metadata = { title: "Scripts" };

export default function ScriptsPage() {
  return <Scripts />;
}
