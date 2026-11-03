import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

/** Carte recto/verso qui se retourne en 3D : une question au recto, la réponse au verso. */
export default defineAnimation({
 label:"Carte retournée 3D",description:"Une carte apparaît en perspective puis se retourne d'un demi-tour : le recto pose la question, le verso donne la réponse. Pour un avant/après ou une révélation.",lengthMs:4000,
 props:z.strictObject({recto:z.string().trim().min(1).max(40),verso:z.string().trim().min(1).max(40)}),
 example:{recto:"Seul ?",verso:"Avec un réseau"},
 css:`.anim-carte-retournee { ${SAFE_BLOCK} top:380px; height:300px; perspective:1600px; }
 .anim-carte-retournee .carte { position:relative; width:100%; height:100%; transform-style:preserve-3d; }
 .anim-carte-retournee .face { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:24px 32px; border-radius:24px; text-align:center; font-size:60px; font-weight:800; line-height:1.15; overflow-wrap:anywhere; backface-visibility:hidden; box-shadow:0 40px 80px rgba(0,0,0,0.4); }
 .anim-carte-retournee .recto { background:${COLORS.white}; color:${COLORS.black}; }
 .anim-carte-retournee .verso { background:${COLORS.blue}; color:${COLORS.white}; transform:rotateY(180deg); }`,
 render:(c,p)=>({
  html:`<div id="${c.id}" class="anim-carte-retournee"><div id="${c.id}-carte" class="carte"><div class="face recto">${escapeHtml(p.recto)}</div><div class="face verso">${escapeHtml(p.verso)}</div></div></div>`,
  tweens:[
   `tl.fromTo("#${c.id}", { opacity:0 }, { opacity:1, duration:0.3, ease:"power2.out" }, ${r2(c.start)});`,
   `tl.fromTo("#${c.id}-carte", { rotationX:55, z:-400 }, { rotationX:0, z:0, duration:0.55, ease:"power3.out" }, ${r2(c.start)});`,
   `tl.to("#${c.id}-carte", { rotationY:180, duration:0.7, ease:"power3.inOut" }, ${r2(c.start+c.duration*0.45)});`,
   fadeOut(c.id,c),
  ],
 }),
});
