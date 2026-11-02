import type { Metadata } from "next";
import MyReels from "@/components/reels/my-reels";

export const metadata: Metadata = { title: "Mes réels" };

export default function HomePage() {
  return <MyReels />;
}
