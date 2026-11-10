import { describe, expect, it } from "vitest";
import { canvaSuggestBrief, isFactualField, parseCanvaSuggestions } from "@/domain/instagram/canva-suggest";

const FIELDS = ["titre", "sous titre", "date", "horaire", "lieu", "adresse", "club Business Club", "style de reunion"];
const CTX = "Réunion spéciale invités du Dax Business Club mardi 3 novembre de 10h à 12h à l'Hôtel Kyriad.";

describe("suggestions IA des zones Canva", () => {
  it("repère les zones factuelles", () => {
    expect(FIELDS.filter(isFactualField)).toEqual(["date", "horaire", "lieu", "adresse", "club Business Club"]);
    expect(canvaSuggestBrief(FIELDS, CTX)).toContain('"sous titre"');
  });
  it("garde le rédactionnel, n'invente aucune donnée factuelle", () => {
    const raw = JSON.stringify({ titre: "Et si ton prochain client venait de ton réseau ?", "sous titre": "Réunion spéciale invités", date: "Mardi 3 novembre", horaire: "10h-12h", lieu: "Hôtel Kyriad", adresse: "276 avenue Foch, Saint-Paul-lès-Dax", "club Business Club": "Dax Business Club", "style de reunion": "Petit-déjeuner", inconnu: "x" });
    const r = parseCanvaSuggestions(`Voici : ${raw}`, FIELDS, CTX);
    expect(r.texts).toEqual({ titre: "Et si ton prochain client venait de ton réseau ?", "sous titre": "Réunion spéciale invités", date: "Mardi 3 novembre", horaire: "10h-12h", lieu: "Hôtel Kyriad", "club Business Club": "Dax Business Club", "style de reunion": "Petit-déjeuner" });
    expect(r.skipped).toEqual(["adresse"]);
  });
  it("réponse illisible : rien de rempli", () => {
    expect(parseCanvaSuggestions("pas de json", FIELDS, CTX).texts).toEqual({});
  });
});
