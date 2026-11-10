import { redirect } from "next/navigation";

/** Le Reel éditorial est devenu le Studio IA par défaut. */
export default function EditorialRedirect() {
  redirect("/reels/nouveau/ia");
}
