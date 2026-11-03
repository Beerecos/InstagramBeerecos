import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

/** Liste en cascade : chaque ligne bascule depuis l'arrière, comme un panneau à palettes. */
export default defineAnimation({
 label:"Cascade 3D",description:"Deux à cinq lignes basculent l'une après l'autre depuis l'arrière, comme les palettes d'un panneau d'affichage. Pour une liste d'étapes ou d'arguments.",lengthMs:4500,
 props:z.strictObject({items:z.array(z.string().trim().min(1).max(32)).min(2).max(5)}),
 example:{items:["Se présenter","Écouter","Recommander"]},
 css:`.anim-cascade-3d { ${SAFE_BLOCK} top:400px; display:flex; flex-direction:column; gap:18px; perspective:1400px; }
 .anim-cascade-3d p { margin:0; padding:22px 28px; border-radius:14px; font-size:48px; font-weight:700; line-height:1.2; background:${COLORS.white}; color:${COLORS.black}; border-left:12px solid ${COLORS.blue}; box-shadow:0 18px 40px rgba(0,0,0,0.3); transform-origin:50% 0%; backface-visibility:hidden; overflow-wrap:anywhere; }`,
 render:(c,p)=>({
  html:`<div id="${c.id}" class="anim-cascade-3d">${p.items.map((t,i)=>`<p id="${c.id}-i${i}">${escapeHtml(t)}</p>`).join("")}</div>`,
  tweens:[
   ...p.items.map((_,i)=>`tl.fromTo("#${c.id}-i${i}", { opacity:0, rotationX:-95, z:-120 }, { opacity:1, rotationX:0, z:0, duration:0.55, ease:"back.out(1.6)" }, ${r2(c.start+i*c.duration*0.5/p.items.length)});`),
   fadeOut(c.id,c),
  ],
 }),
});
