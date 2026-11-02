import { redirect } from "next/navigation";

/** Ancienne page « video » (missions) : le studio des réels la remplace. */
export default function LegacyPage() {
  redirect("/reels/nouveau/video");
}
