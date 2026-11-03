import { z } from "zod";
import { defineAnimation, titleLines } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

/** Ombre en relief (couches décalées) : le titre paraît extrudé. */
const RELIEF = Array.from({ length: 8 }, (_, i) => `${i + 1}px ${i + 1}px 0 ${COLORS.blue}`).join(", ");

/** Titre qui arrive du fond de l'image, ligne par ligne, en perspective, avec un relief bleu. */
export default defineAnimation({
 label:"Titre en profondeur 3D",description:"Le titre surgit du fond de l'image ligne par ligne, incliné en perspective, avec un relief bleu, puis se redresse lentement. Pour une accroche forte.",lengthMs:3500,
 props:z.strictObject({texte:z.string().trim().min(1).max(60)}),
 example:{texte:"Le réseau qui recommande"},
 css:`.anim-titre-profondeur { ${SAFE_BLOCK} top:360px; perspective:1200px; text-align:center; }
 .anim-titre-profondeur .bloc { transform-style:preserve-3d; }
 .anim-titre-profondeur p { margin:0; font-size:92px; font-weight:900; line-height:1.05; text-transform:uppercase; color:${COLORS.white}; text-shadow:${RELIEF}, 12px 18px 30px rgba(0,0,0,0.45); overflow-wrap:anywhere; }`,
 render:(c,p)=>{
  const lines=titleLines(p.texte);
  return {
   html:`<div id="${c.id}" class="anim-titre-profondeur"><div id="${c.id}-bloc" class="bloc">${lines.map((l,i)=>`<p id="${c.id}-l${i}">${escapeHtml(l)}</p>`).join("")}</div></div>`,
   tweens:[
    ...lines.map((_,i)=>`tl.fromTo("#${c.id}-l${i}", { opacity:0, z:-900, rotationX:70 }, { opacity:1, z:0, rotationX:0, duration:0.6, ease:"expo.out" }, ${r2(c.start+i*0.14)});`),
    `tl.fromTo("#${c.id}-bloc", { rotationY:-18, rotationX:14 }, { rotationY:6, rotationX:4, duration:${r2(Math.max(0.5,c.duration-0.3))}, ease:"sine.inOut" }, ${r2(c.start)});`,
    fadeOut(c.id,c),
   ],
  };
 },
});
