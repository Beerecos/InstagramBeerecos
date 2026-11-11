import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, cardIn, escapeHtml, fadeOut, intensityOf, r2 } from "../fx";

/** Carte flottante (Studio animations, 2026-11-11) : une question, une idée, une étape, un bénéfice, une info ou une citation. */
const TYPES = { question: "Question", idee: "Idée clé", etape: "Étape", benefice: "Bénéfice", info: "À retenir", citation: "Citation" } as const;
const TOP = { haut: 300, milieu: 700, bas: 1010 } as const;

export default defineAnimation({
 label:"Carte flottante",description:"Une carte blanche arrondie entre en 0,24 s (fondu, petit déplacement, légère variation d'échelle), se stabilise puis flotte très légèrement. Pour une question, une idée importante, une étape, un bénéfice, une information ou une citation du discours.",lengthMs:3500,
 props:z.strictObject({
  titre:z.string().trim().min(1).max(60),
  texte:z.string().trim().max(120).optional(),
  type:z.enum(["question","idee","etape","benefice","info","citation"]).default("idee"),
  position:z.enum(["haut","milieu","bas"]).default("haut"),
 }),
 example:{titre:"Qui sait vraiment quand te recommander ?",type:"question"},
 css:`.anim-carte-flottante { ${SAFE_BLOCK} }
 .anim-carte-flottante .carte { background:${COLORS.white}; color:${COLORS.black}; border-radius:28px; padding:34px 40px 38px; box-shadow:0 18px 44px rgba(0,0,0,0.22); }
 .anim-carte-flottante .tag { display:inline-block; margin-bottom:16px; padding:8px 18px; border-radius:999px; background:${COLORS.blue}; color:${COLORS.white}; font-size:28px; font-weight:600; letter-spacing:0.02em; }
 .anim-carte-flottante .t { margin:0; font-size:52px; font-weight:700; line-height:1.18; overflow-wrap:anywhere; }
 .anim-carte-flottante .d { margin:14px 0 0; font-size:36px; font-weight:500; line-height:1.3; color:rgba(0,0,0,0.68); overflow-wrap:anywhere; }`,
 render:(c,p)=>{
  const titre=p.type==="citation"?`« ${p.titre} »`:p.titre;
  const k=intensityOf(c), hold=c.duration-0.24-0.4, period=1.8;
  const floats=k>0&&hold>period?Math.floor(hold/period)-1:-1;
  return {
   html:`<div id="${c.id}" class="anim-carte-flottante" style="top:${TOP[p.position]}px"><div id="${c.id}-c" class="carte"><span class="tag">${TYPES[p.type]}</span><p class="t">${escapeHtml(titre)}</p>${p.texte?`<p class="d">${escapeHtml(p.texte)}</p>`:""}</div></div>`,
   tweens:[
    cardIn(`${c.id}-c`,c.start,c),
    ...(floats>=0?[`tl.to("#${c.id}", { y: ${r2(-6*k)}, duration: ${period/2}, ease: "sine.inOut", repeat: ${floats*2+1}, yoyo: true }, ${r2(c.start+0.3)});`]:[]),
    fadeOut(c.id,c,0.25),
   ],
   sfx:[{at:r2(c.start),kind:"glisse"}],
  };
 },
});
