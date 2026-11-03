import { guarded } from "@/server/instagram/http";
import { signedUpload } from "@/server/instagram/store";

/** Lien d'envoi d'une photo de post (JPEG préparé dans le navigateur), dans le bucket privé ig-media. */
export function POST() {
  return guarded("content:edit", ({ userId }) => signedUpload(userId));
}
