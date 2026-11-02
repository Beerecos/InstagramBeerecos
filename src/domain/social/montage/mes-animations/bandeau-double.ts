import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

export default defineAnimation({
 label:"Bandeau double",description:"Deux rubans coloré et blanc s'ouvrent en largeur, droits ou inclinés. La seconde ligne peut changer à mi-parcours pour souligner une progression.",lengthMs:3000,
 props:z.strictObject({texte:z.string().trim().min(1).max(38),detail:z.string().trim().min(1).max(38),remplacement:z.string().trim().max(38).optional(),angle:z.number().min(-12).max(12).default(-7)}),
 example:{texte:"Chaque action",detail:"a de la valeur",remplacement:"crée une opportunité",angle:-7},
 css:`.anim-bandeau-double { ${SAFE_BLOCK} top:400px; display:flex; flex-direction:column; align-items:stretch; gap:10px; }
 .anim-bandeau-double p { margin:0; padding:18px 28px; font-size:48px; font-weight:600; text-align:center; line-height:1.2; overflow-wrap:anywhere; }
 .anim-bandeau-double .primary { background:${COLORS.blue}; color:${COLORS.white}; }
 .anim-bandeau-double .secondary { margin:0 22px; display:grid; background:${COLORS.white}; color:${COLORS.black}; }
 .anim-bandeau-double .secondary p { grid-area:1/1; }
 .anim-bandeau-double .replacement { opacity:0; }`,
 render:(c,p)=>{
  const open=(id:string,at:number)=>`tl.fromTo("#${id}", { clipPath: "inset(0 50% 0 50%)", opacity:0 }, { clipPath: "inset(0 0% 0 0%)", opacity:1, duration:${Math.min(0.4,c.duration/6)}, ease:"power3.out" }, ${r2(at)});`;
  const mid=r2(c.start+c.duration*0.55);
  return {html:`<div id="${c.id}" class="anim-bandeau-double" style="transform:rotate(${p.angle}deg)"><p id="${c.id}-t" class="primary">${escapeHtml(p.texte)}</p><div id="${c.id}-s" class="secondary"><p id="${c.id}-d">${escapeHtml(p.detail)}</p>${p.remplacement?`<p id="${c.id}-r" class="replacement">${escapeHtml(p.remplacement)}</p>`:""}</div></div>`,tweens:[open(`${c.id}-t`,c.start),open(`${c.id}-s`,c.start+c.duration*0.08),...(p.remplacement?[`tl.set("#${c.id}-r", { opacity:0 }, ${c.start});`,`tl.to("#${c.id}-d", { opacity:0, duration:0.12 }, ${mid});`,`tl.to("#${c.id}-r", { opacity:1, duration:0.18 }, ${mid});`]:[]),fadeOut(c.id,c)]};
 },
});
