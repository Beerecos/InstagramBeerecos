import type { AnimationDef } from "../animations";

/**
 * Animations créées pour BeeRecos (par Claude avec /nouvelle-animation, ou à la main).
 * Une animation = un fichier `<nom>.ts` dans ce dossier qui exporte `default defineAnimation({ … })`,
 * puis une ligne ici. À nom égal, elle remplace celle du kit. Ce dossier n'est jamais réécrit par le kit.
 */
import papier from "./papier-dechire";
import bandeau from "./bandeau-double";
import piliers from "./piliers-progressifs";
import impact from "./mot-impact";
import cube3d from "./cube-3d";
import carte3d from "./carte-retournee";
import titre3d from "./titre-profondeur";
import cascade3d from "./cascade-3d";
import tour from "./tour-blocs";
import orbite from "./icones-orbite";
import puce from "./puce-lumineuse";
import arbre from "./arbre-pousse";
import fusee from "./fusee-decollage";
import carteFlottante from "./carte-flottante";
import checklist from "./checklist";
import capsules from "./capsules";
import motCentral from "./mot-central";
import parcours from "./parcours";
import ctaSaisie from "./cta-saisie";
import objetInterface from "./objet-interface";
export const USER_ANIMATIONS: Record<string, AnimationDef> = {
  "papier-dechire": papier, "bandeau-double": bandeau, "piliers-progressifs": piliers, "mot-impact": impact,
  "cube-3d": cube3d, "carte-retournee": carte3d, "titre-profondeur": titre3d, "cascade-3d": cascade3d,
  "tour-blocs": tour, "icones-orbite": orbite, "puce-lumineuse": puce, "arbre-pousse": arbre, "fusee-decollage": fusee,
  // Studio animations (2026-11-11)
  "carte-flottante": carteFlottante, "checklist": checklist, "capsules": capsules, "mot-central": motCentral, "parcours": parcours, "cta-saisie": ctaSaisie, "objet-interface": objetInterface,
};
