import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { escapeHtml, fadeOut, r2 } from "../fx";

const TRACES = ["M200 120 V40 H120","M260 120 V20","M320 120 V60 H420","M380 200 H470 V120","M380 300 H500","M300 380 V470 H400","M220 380 V500","M120 300 H40 V380","M120 220 H20"];

/** Puce électronique en vue isométrique : les pistes s'allument, des cadres lumineux s'en échappent. */
export default defineAnimation({
 label:"Puce lumineuse 3D",description:"Une puce électronique en vue isométrique : ses pistes s'allument une à une et des cadres lumineux s'en échappent, avec un mot optionnel. Pour la digitalisation, l'IA, la technologie.",lengthMs:3500,
 props:z.strictObject({texte:z.string().trim().max(16).default("")}),
 example:{texte:"IA"},
 css:`.anim-puce-lumineuse { position:absolute; left:90px; right:170px; top:340px; height:760px; perspective:1600px; }
 .anim-puce-lumineuse .iso { position:absolute; left:50%; top:50%; width:520px; height:520px; margin:-260px 0 0 -260px; transform:rotateX(55deg) rotateZ(-45deg); transform-style:preserve-3d; }
 .anim-puce-lumineuse svg { position:absolute; inset:0; overflow:visible; }
 .anim-puce-lumineuse .trace { fill:none; stroke:#8fb0ff; stroke-width:6; stroke-linecap:round; stroke-dasharray:1; stroke-dashoffset:1; filter:drop-shadow(0 0 8px ${COLORS.blue}); }
 .anim-puce-lumineuse .cadre { position:absolute; left:120px; top:120px; width:280px; height:280px; border:5px solid rgba(143,176,255,0.9); border-radius:18px; box-shadow:0 0 30px ${COLORS.blue}; opacity:0; }
 .anim-puce-lumineuse .coeur { position:absolute; left:120px; top:120px; width:280px; height:280px; border-radius:22px; background:linear-gradient(135deg, #3d5cff 0%, ${COLORS.blue} 50%, #142c9e 100%); box-shadow:0 0 60px rgba(40,81,255,0.9), 18px 18px 0 #0d1d6e; display:flex; align-items:center; justify-content:center; }
 .anim-puce-lumineuse .coeur span { font-size:96px; font-weight:900; color:${COLORS.white}; transform:rotateZ(45deg); }`,
 render:(c,p)=>({
  html:`<div id="${c.id}" class="anim-puce-lumineuse"><div id="${c.id}-iso" class="iso"><svg viewBox="0 0 520 520">${TRACES.map((d,i)=>`<path id="${c.id}-t${i}" class="trace" pathLength="1" d="${d}"/>`).join("")}</svg>${[0,1,2].map(i=>`<div id="${c.id}-f${i}" class="cadre"></div>`).join("")}<div id="${c.id}-coeur" class="coeur">${p.texte?`<span>${escapeHtml(p.texte)}</span>`:""}</div></div></div>`,
  tweens:[
   `tl.fromTo("#${c.id}", { opacity:0 }, { opacity:1, duration:0.25, ease:"none" }, ${r2(c.start)});`,
   `tl.fromTo("#${c.id}-iso", { z:-500, rotationZ:-80 }, { z:0, rotationZ:-45, duration:0.7, ease:"power3.out" }, ${r2(c.start)});`,
   ...TRACES.map((_,i)=>`tl.to("#${c.id}-t${i}", { strokeDashoffset:0, duration:0.4, ease:"power1.inOut" }, ${r2(c.start+0.5+i*0.08)});`),
   ...[0,1,2].map(i=>`tl.fromTo("#${c.id}-f${i}", { scale:1, z:0, opacity:0.9 }, { scale:1.9, z:120, opacity:0, duration:0.9, ease:"power2.out" }, ${r2(c.start+1.1+i*c.duration*0.15)});`),
   fadeOut(c.id,c),
  ],
 }),
});
