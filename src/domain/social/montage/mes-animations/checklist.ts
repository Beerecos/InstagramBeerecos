import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, cardIn, escapeHtml, fadeOut, itemAt, r2 } from "../fx";

/**
 * Checklist (Studio animations, 2026-11-11) : chaque ligne apparaît puis se coche au moment où elle est dite
 * (repères de l'animation, recalculés après les coupes), l'étape terminée reste légèrement mise en valeur.
 */
export default defineAnimation({
 label:"Checklist",description:"Une liste de deux à cinq actions : chaque ligne apparaît puis se coche quand le présentateur l'évoque (un repère par ligne), l'étape faite passe en bleu. Pour une liste d'actions ou d'étapes à suivre.",lengthMs:5000,
 props:z.strictObject({
  titre:z.string().trim().max(40).optional(),
  items:z.array(z.string().trim().min(1).max(34)).min(2).max(5),
 }),
 example:{titre:"Pour commencer",items:["Choisir son club","Demander son invitation","Participer à une réunion"]},
 css:`.anim-checklist { ${SAFE_BLOCK} top:330px; }
 .anim-checklist .panneau { background:${COLORS.white}; border-radius:28px; padding:30px 34px; box-shadow:0 18px 44px rgba(0,0,0,0.22); }
 .anim-checklist .titre { margin:0 0 14px; font-size:30px; font-weight:600; color:${COLORS.blue}; text-transform:uppercase; letter-spacing:0.04em; }
 .anim-checklist .ligne { display:flex; align-items:center; gap:22px; padding:14px 12px; border-radius:16px; opacity:0; }
 .anim-checklist .case { flex:none; width:52px; height:52px; border-radius:14px; border:4px solid ${COLORS.blue}; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
 .anim-checklist .case svg { width:34px; height:34px; }
 .anim-checklist .case path { fill:none; stroke:${COLORS.white}; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:32; stroke-dashoffset:32; }
 .anim-checklist .lbl { font-size:44px; font-weight:600; line-height:1.2; color:${COLORS.black}; overflow-wrap:anywhere; }`,
 render:(c,p)=>{
  const n=p.items.length;
  const tweens:string[]=[cardIn(`${c.id}-p`,c.start,c)];
  const sfx:{at:number;kind:"clic"}[]=[];
  p.items.forEach((_,i)=>{
   const t=itemAt(c,i,n,{lead:0.2,share:0.62}), done=r2(t+0.3);
   tweens.push(
    `tl.fromTo("#${c.id}-l${i}", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.22, ease: "power3.out" }, ${t});`,
    `tl.to("#${c.id}-k${i}", { backgroundColor: "${COLORS.blue}", duration: 0.12, ease: "none" }, ${done});`,
    `tl.to("#${c.id}-v${i}", { strokeDashoffset: 0, duration: 0.24, ease: "power2.out" }, ${done});`,
    `tl.to("#${c.id}-l${i}", { backgroundColor: "rgba(40, 81, 255, 0.08)", duration: 0.2, ease: "power2.out" }, ${done});`,
   );
   sfx.push({at:done,kind:"clic"});
  });
  tweens.push(fadeOut(c.id,c,0.25));
  return {
   html:`<div id="${c.id}" class="anim-checklist"><div id="${c.id}-p" class="panneau">${p.titre?`<p class="titre">${escapeHtml(p.titre)}</p>`:""}${p.items.map((t,i)=>`<div id="${c.id}-l${i}" class="ligne"><span id="${c.id}-k${i}" class="case"><svg viewBox="0 0 32 32"><path id="${c.id}-v${i}" d="M7 17 l6 6 l12 -13" /></svg></span><span class="lbl">${escapeHtml(t)}</span></div>`).join("")}</div></div>`,
   tweens, sfx,
  };
 },
});
