import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

const FACE = 170;

/** Cube en perspective : chaque face porte un mot ; le cube bascule vers le haut pour passer au mot suivant. */
export default defineAnimation({
 label:"Cube 3D",description:"Un cube en perspective bascule vers le haut : chaque face révèle un mot (deux à quatre). Pour enchaîner des idées courtes avec un effet de profondeur.",lengthMs:4500,
 props:z.strictObject({items:z.array(z.string().trim().min(1).max(18)).min(2).max(4)}),
 example:{items:["RENCONTRER","ÉCHANGER","RECOMMANDER"]},
 css:`.anim-cube-3d { ${SAFE_BLOCK} top:420px; height:${FACE}px; perspective:1400px; }
 .anim-cube-3d .cube { position:relative; width:100%; height:100%; transform-style:preserve-3d; }
 .anim-cube-3d .face { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; border-radius:18px; font-size:64px; font-weight:800; letter-spacing:1px; backface-visibility:hidden; background:${COLORS.blue}; color:${COLORS.white}; box-shadow:0 30px 60px rgba(0,0,0,0.35); }
 .anim-cube-3d .face:nth-child(even) { background:${COLORS.white}; color:${COLORS.black}; }`,
 render:(c,p)=>{
  const step=c.duration*0.7/p.items.length;
  const d=r2(Math.min(0.5,step*0.6));
  return {
   html:`<div id="${c.id}" class="anim-cube-3d"><div id="${c.id}-cube" class="cube">${p.items.map((t,i)=>`<div class="face" style="transform: rotateX(${-i*90}deg) translateZ(${FACE/2}px);">${escapeHtml(t)}</div>`).join("")}</div></div>`,
   tweens:[
    `tl.fromTo("#${c.id}", { opacity:0, y:60 }, { opacity:1, y:0, duration:0.35, ease:"power3.out" }, ${r2(c.start)});`,
    `tl.fromTo("#${c.id}-cube", { rotationX:0, rotationY:-35 }, { rotationX:0, rotationY:0, duration:0.5, ease:"power3.out" }, ${r2(c.start)});`,
    ...p.items.slice(1).map((_,i)=>`tl.to("#${c.id}-cube", { rotationX:${(i+1)*90}, duration:${d}, ease:"back.inOut(1.4)" }, ${r2(c.start+0.2+(i+1)*step)});`),
    fadeOut(c.id,c),
   ],
  };
 },
});
