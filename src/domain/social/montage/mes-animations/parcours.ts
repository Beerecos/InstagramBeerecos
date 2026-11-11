import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, cardIn, escapeHtml, fadeOut, itemAt, r2 } from "../fx";

/**
 * Parcours (Studio animations, 2026-11-11) : les étapes s'empilent (format vertical), chacune apparaît, se relie à la
 * précédente puis se valide, sur son repère quand il existe.
 */
export default defineAnimation({
 label:"Parcours",description:"Deux à cinq étapes empilées se construisent une à une : chaque étape apparaît, un trait la relie à la précédente, puis elle se valide. Pour un parcours ou une progression : Contact → Invitation → Rencontre → Recommandation.",lengthMs:5500,
 props:z.strictObject({
  titre:z.string().trim().max(36).optional(),
  etapes:z.array(z.string().trim().min(1).max(24)).min(2).max(5),
 }),
 example:{etapes:["Contact","Invitation","Rencontre","Recommandation"]},
 css:`.anim-parcours { ${SAFE_BLOCK} top:320px; }
 .anim-parcours .titre { margin:0 0 18px; font-size:34px; font-weight:700; color:${COLORS.white}; text-shadow:0 2px 14px rgba(0,0,0,0.6); }
 .anim-parcours .etape { position:relative; display:flex; align-items:center; gap:24px; margin-bottom:34px; opacity:0; }
 .anim-parcours .pastille { position:relative; z-index:1; flex:none; width:78px; height:78px; border-radius:50%; background:${COLORS.white}; border:5px solid ${COLORS.blue}; box-sizing:border-box; display:flex; align-items:center; justify-content:center; color:${COLORS.blue}; font-size:34px; font-weight:700; }
 .anim-parcours .pastille svg { position:absolute; width:40px; height:40px; opacity:0; }
 .anim-parcours .pastille path { fill:none; stroke:${COLORS.white}; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; }
 .anim-parcours .lbl { padding:16px 28px; border-radius:20px; background:${COLORS.white}; color:${COLORS.black}; font-size:44px; font-weight:600; box-shadow:0 12px 30px rgba(0,0,0,0.2); }
 .anim-parcours .lien { position:absolute; left:35px; top:78px; width:8px; height:34px; background:${COLORS.white}; box-shadow:0 0 0 2px ${COLORS.blue}; transform-origin:50% 0%; transform:scaleY(0); }`,
 render:(c,p)=>{
  const n=p.etapes.length, tweens:string[]=[];
  const sfx:{at:number;kind:"clic"}[]=[];
  p.etapes.forEach((_,i)=>{
   const t=itemAt(c,i,n,{lead:0.15,share:0.7}), ok=r2(t+0.32);
   tweens.push(cardIn(`${c.id}-e${i}`,t,c,{y:20}));
   if(i>0) tweens.push(`tl.to("#${c.id}-l${i-1}", { scaleY: 1, duration: 0.2, ease: "power2.out" }, ${r2(Math.max(c.start,t-0.12))});`);
   // Étape validée : pastille bleue cerclée de blanc (lisible sur fond bleu), le numéro laisse place à la coche.
   tweens.push(`tl.to("#${c.id}-o${i}", { backgroundColor: "${COLORS.blue}", borderColor: "${COLORS.white}", duration: 0.14, ease: "none" }, ${ok});`,
    `tl.to("#${c.id}-n${i}", { opacity: 0, duration: 0.1, ease: "none" }, ${ok});`,
    `tl.fromTo("#${c.id}-s${i}", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, ${ok});`);
   sfx.push({at:ok,kind:"clic"});
  });
  tweens.push(fadeOut(c.id,c,0.25));
  return {
   html:`<div id="${c.id}" class="anim-parcours">${p.titre?`<p class="titre">${escapeHtml(p.titre)}</p>`:""}${p.etapes.map((t,i)=>`<div id="${c.id}-e${i}" class="etape"><span id="${c.id}-o${i}" class="pastille"><span id="${c.id}-n${i}">${i+1}</span><svg id="${c.id}-s${i}" viewBox="0 0 32 32"><path d="M7 17 l6 6 l12 -13" /></svg></span><span class="lbl">${escapeHtml(t)}</span>${i<n-1?`<span id="${c.id}-l${i}" class="lien"></span>`:""}</div>`).join("")}</div>`,
   tweens, sfx,
  };
 },
});
