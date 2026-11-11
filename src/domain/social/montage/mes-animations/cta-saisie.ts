import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, cardIn, escapeHtml, fadeOut, r2 } from "../fx";

/**
 * CTA avec saisie (Studio animations, 2026-11-11) : une barre de commentaire apparaît, le mot se tape lettre par
 * lettre, une petite animation d'envoi le confirme ; la consigne reste visible jusqu'à la fin.
 */
export default defineAnimation({
 label:"CTA avec saisie",description:"Une barre de commentaire apparaît, le mot-clé s'y tape lettre par lettre, le bouton d'envoi part puis une coche confirme ; la consigne (« Écris CLUB en commentaire ») reste lisible jusqu'à la fin. Pour l'appel à l'action final ; une seule fois par Reel.",lengthMs:4500,
 props:z.strictObject({
  mot:z.string().trim().min(1).max(16),
  consigne:z.string().trim().max(48).optional(),
 }),
 example:{mot:"CLUB",consigne:"Écris CLUB en commentaire"},
 css:`.anim-cta-saisie { ${SAFE_BLOCK} top:1040px; display:flex; flex-direction:column; align-items:center; gap:22px; }
 .anim-cta-saisie .barre { width:100%; box-sizing:border-box; display:flex; align-items:center; gap:18px; padding:16px 16px 16px 34px; border-radius:999px; background:${COLORS.white}; box-shadow:0 16px 40px rgba(0,0,0,0.25); }
 .anim-cta-saisie .champ { flex:1; display:flex; align-items:center; min-height:64px; font-size:50px; font-weight:700; color:${COLORS.black}; letter-spacing:0.02em; }
 .anim-cta-saisie .curseur { width:5px; height:52px; margin-left:6px; background:${COLORS.blue}; }
 .anim-cta-saisie .envoi { position:relative; flex:none; width:84px; height:84px; border-radius:50%; background:${COLORS.blue}; display:flex; align-items:center; justify-content:center; overflow:hidden; }
 .anim-cta-saisie .envoi svg { position:absolute; width:42px; height:42px; }
 .anim-cta-saisie .envoi path { fill:none; stroke:${COLORS.white}; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; }
 .anim-cta-saisie .consigne { margin:0; padding:14px 30px; border-radius:18px; background:rgba(0,0,0,0.62); color:${COLORS.white}; font-size:40px; font-weight:600; text-align:center; }`,
 render:(c,p)=>{
  const mot=p.mot.toUpperCase(), consigne=p.consigne||`Écris ${mot} en commentaire`;
  const t0=r2(c.start+0.35), step=0.11, typed=r2(t0+mot.length*step), send=r2(typed+0.25);
  const tweens=[
   cardIn(`${c.id}-b`,c.start,c),
   `tl.fromTo("#${c.id}-g", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, ${r2(c.start+0.1)});`,
   ...[...mot].map((_,k)=>`tl.set("#${c.id}-t", { textContent: ${JSON.stringify(mot.slice(0,k+1))} }, ${r2(t0+(k+1)*step)});`),
   `tl.to("#${c.id}-u", { opacity: 0, duration: 0.05, ease: "none" }, ${send});`,
   `tl.to("#${c.id}-e", { scale: 0.86, duration: 0.08, ease: "power2.in" }, ${send});`,
   `tl.to("#${c.id}-e", { scale: 1, duration: 0.16, ease: "back.out(3)" }, ${r2(send+0.08)});`,
   `tl.to("#${c.id}-f", { x: 60, y: -60, opacity: 0, duration: 0.24, ease: "power2.in" }, ${r2(send+0.05)});`,
   `tl.fromTo("#${c.id}-k", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, ${r2(send+0.28)});`,
   fadeOut(c.id,c,0.25),
  ];
  return {
   html:`<div id="${c.id}" class="anim-cta-saisie"><div id="${c.id}-b" class="barre"><span class="champ"><span id="${c.id}-t"></span><span id="${c.id}-u" class="curseur"></span></span><span id="${c.id}-e" class="envoi"><svg id="${c.id}-f" viewBox="0 0 32 32"><path d="M5 16 h20 M17 8 l8 8 l-8 8" /></svg><svg id="${c.id}-k" viewBox="0 0 32 32" style="opacity:0"><path d="M7 17 l6 6 l12 -13" /></svg></span></div><p id="${c.id}-g" class="consigne">${escapeHtml(consigne)}</p></div>`,
   tweens,
   sfx:[...[...mot].map((_,k)=>({at:r2(t0+(k+1)*step),kind:"saisie" as const})),{at:send,kind:"clic" as const}],
  };
 },
});
