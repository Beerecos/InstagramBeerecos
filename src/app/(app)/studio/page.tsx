import { redirect } from "next/navigation";

/** Ancienne page « studio » (missions) : le studio des réels la remplace. */
export default function LegacyPage() {
  redirect("/");
}
