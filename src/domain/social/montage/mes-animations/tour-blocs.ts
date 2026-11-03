import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { fadeOut, r2 } from "../fx";

/** Décalages fixes (pas de hasard : le rendu doit être identique à chaque lecture). */
const DRIFT = [-1, 1, -0.6, 0.8, -0.3, 0.5, -0.9, 0.2];

/** Tour de blocs en perspective : elle se construit, vacille puis s'effondre. Illustration plein écran. */
export default defineAnimation({
 label:"Tour de blocs qui s'effondre",description:"Une tour de blocs bleus et blancs se construit en perspective, vacille puis s'effondre. Illustration plein écran pour un problème, une fragilité, « tout s'écroule ».",lengthMs:3500,
 props:z.strictObject({etages:z.number().int().min(4).max(8).default(6),fond:z.boolean().default(true)}),
 example:{etages:6,fond:true},
 css:`.anim-tour-blocs { position:absolute; inset:0; perspective:1600px; overflow:hidden; }
 .anim-tour-blocs.fond { background:radial-gradient(circle at 50% 40%, #1b2a6b 0%, ${COLORS.black} 75%); }
 .anim-tour-blocs .tour { position:absolute; left:50%; bottom:560px; width:360px; margin-left:-180px; display:flex; flex-direction:column-reverse; transform:rotateX(14deg) rotateY(-22deg); transform-style:preserve-3d; }
 .anim-tour-blocs .bloc { height:120px; margin-top:6px; border-radius:10px; background:linear-gradient(135deg, ${COLORS.blue} 0%, #1a37c4 100%); box-shadow:inset 0 -14px 0 rgba(0,0,0,0.25), 0 20px 30px rgba(0,0,0,0.35); }
 .anim-tour-blocs .bloc:nth-child(even) { background:linear-gradient(135deg, ${COLORS.white} 0%, #d9def0 100%); }
 .anim-tour-blocs .sol { position:absolute; left:15%; right:15%; bottom:520px; height:40px; border-radius:50%; background:rgba(0,0,0,0.45); filter:blur(14px); }`,
 render:(c,p)=>{
  const n=p.etages;
  const build=c.duration*0.45, fall=c.start+c.duration*0.62;
  return {
   html:`<div id="${c.id}" class="anim-tour-blocs${p.fond?" fond":""}"><div class="sol"></div><div id="${c.id}-tour" class="tour">${Array.from({length:n},(_,i)=>`<div id="${c.id}-b${i}" class="bloc"></div>`).join("")}</div></div>`,
   tweens:[
    `tl.fromTo("#${c.id}", { opacity:0 }, { opacity:1, duration:0.2, ease:"none" }, ${r2(c.start)});`,
    ...Array.from({length:n},(_,i)=>`tl.fromTo("#${c.id}-b${i}", { y:-1400, opacity:0 }, { y:0, opacity:1, duration:0.35, ease:"bounce.out" }, ${r2(c.start+i*build/n)});`),
    `tl.to("#${c.id}-tour", { rotationZ:3, duration:0.15, ease:"sine.inOut" }, ${r2(fall-0.35)});`,
    `tl.to("#${c.id}-tour", { rotationZ:-2, duration:0.15, ease:"sine.inOut" }, ${r2(fall-0.2)});`,
    ...Array.from({length:n},(_,i)=>{const k=DRIFT[i%DRIFT.length];return `tl.to("#${c.id}-b${i}", { x:${Math.round(k*(220+i*40))}, y:${1500-i*60}, rotationZ:${Math.round(k*(60+i*15))}, rotationX:${Math.round(k*40)}, duration:0.9, ease:"power2.in" }, ${r2(fall+(n-1-i)*0.05)});`;}),
    fadeOut(c.id,c),
   ],
  };
 },
});
