import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

// Polices chargées avant toute capture : Poppins (charte BeeRecos) et Caveat (manuscrite provisoire).
const faces = [
  ...[300, 400, 500, 600, 700].map((w) => ({ family: "Poppins", weight: String(w), file: `fonts/poppins-latin-${w}-normal.woff2` })),
  { family: "Caveat", weight: "700", file: "fonts/caveat-latin-700-normal.woff2" },
];

const handle = delayRender("Chargement des polices");
Promise.all(faces.map((f) => loadFont({ family: f.family, weight: f.weight, url: staticFile(f.file) })))
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
