import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

export default defineAnimation({
 label:"Piliers progressifs",description:"Deux à quatre barres s'empilent de bas en haut. Chaque barre s'ouvre puis ses lettres se rassemblent, pour construire les piliers d'une explication.",lengthMs:4500,
 props:z.strictObject({items:z.array(z.string().trim().min(1).max(28)).min(2).max(4)}),
 example:{items:["LE RÉSEAU","LA FORMATION","LA DIGITALISATION"]},
 css:`.anim-piliers-progressifs { ${SAFE_BLOCK} top:440px; display:flex; flex-direction:column-reverse; gap:20px; }
 .anim-piliers-progressifs p { margin:0; padding:22px 28px; border-radius:14px; text-align:center; font-size:46px; font-weight:700; line-height:1.2; background:${COLORS.blue}; color:${COLORS.white}; overflow-wrap:anywhere; }
 .anim-piliers-progressifs p:nth-child(even) { background:${COLORS.white}; color:${COLORS.black}; }
 .anim-piliers-progressifs span { display:inline-block; white-space:pre; }`,
 render:(c,p)=>({html:`<div id="${c.id}" class="anim-piliers-progressifs">${p.items.map((t,i)=>`<p id="${c.id}-i${i}">${Array.from(t).map((letter,j)=>`<span id="${c.id}-i${i}-l${j}">${escapeHtml(letter)}</span>`).join("")}</p>`).join("")}</div>`,tweens:[...p.items.flatMap((t,i)=>{
  const at=c.start+i*c.duration*0.48/p.items.length;
  const d=Math.min(0.3,c.duration*0.12);
  return [`tl.fromTo("#${c.id}-i${i}", { scaleX:0, opacity:0 }, { scaleX:1, opacity:1, duration:${d}, ease:"power3.out" }, ${r2(at)});`,...Array.from(t).map((_,j)=>`tl.fromTo("#${c.id}-i${i}-l${j}", { opacity:0, y:12 }, { opacity:1, y:0, duration:${d}, ease:"power2.out" }, ${r2(at+d+j*c.duration*0.12/t.length)});`)];
 }),fadeOut(c.id,c)]}),
});
