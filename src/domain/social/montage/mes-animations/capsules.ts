import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, intensityOf, itemAt, r2 } from "../fx";

/**
 * Capsules de bénéfices (Studio animations, 2026-11-11) : petites étiquettes arrondies qui arrivent l'une après
 * l'autre (sur leurs repères, ou ensemble avec un décalage de 80 à 140 ms), en pile, en ligne ou en grille.
 */
export default defineAnimation({
 label:"Capsules de bénéfices",description:"Deux à six petites étiquettes arrondies (bénéfices, mots-clés) apparaissent successivement, en pile, en ligne ou en petite grille. Pour énumérer des bénéfices courts : des rencontres, des recommandations, des opportunités.",lengthMs:3500,
 props:z.strictObject({
  items:z.array(z.string().trim().min(1).max(24)).min(2).max(6),
  disposition:z.enum(["pile","ligne","grille"]).default("pile"),
  position:z.enum(["haut","milieu"]).default("haut"),
  decalage:z.number().int().min(80).max(140).default(110),
 }),
 example:{items:["Des rencontres","Des recommandations","Des opportunités"]},
 css:`.anim-capsules { ${SAFE_BLOCK} display:flex; gap:18px; }
 .anim-capsules.pile { flex-direction:column; align-items:flex-start; }
 .anim-capsules.ligne { flex-direction:row; flex-wrap:wrap; justify-content:center; }
 .anim-capsules.grille { display:grid; grid-template-columns:1fr 1fr; }
 .anim-capsules span { display:inline-flex; align-items:center; gap:14px; padding:16px 30px 16px 22px; border-radius:999px; background:${COLORS.white}; color:${COLORS.black}; font-size:42px; font-weight:600; line-height:1.15; box-shadow:0 10px 28px rgba(0,0,0,0.2); white-space:nowrap; }
 .anim-capsules span::before { content:""; flex:none; width:18px; height:18px; border-radius:50%; background:${COLORS.blue}; }`,
 render:(c,p)=>{
  const k=intensityOf(c), n=p.items.length;
  const at=(i:number)=>c.marks?.[i]!==undefined?itemAt(c,i,n):r2(c.start+0.15+i*p.decalage/1000);
  return {
   html:`<div id="${c.id}" class="anim-capsules ${p.disposition}" style="top:${p.position==="haut"?320:760}px">${p.items.map((t,i)=>`<span id="${c.id}-i${i}">${escapeHtml(t)}</span>`).join("")}</div>`,
   tweens:[
    ...p.items.map((_,i)=>`tl.fromTo("#${c.id}-i${i}", { opacity: 0, y: ${r2(18*k)}, scale: ${r2(1-0.15*k)} }, { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "back.out(1.7)" }, ${at(i)});`),
    fadeOut(c.id,c,0.25),
   ],
  };
 },
});
