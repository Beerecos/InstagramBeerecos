import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { escapeHtml, exitAt, intensityOf, r2 } from "../fx";

/**
 * Mot central (Studio animations, 2026-11-11) : la vidéo se floute et s'assombrit un instant, un mot important
 * apparaît au centre (petite amorce, mot très grand, court complément), puis l'image revient telle quelle.
 */
const VOILE = { douce: { blur: 6, dim: 0.72 }, moyenne: { blur: 11, dim: 0.55 }, forte: { blur: 18, dim: 0.4 } } as const;

export default defineAnimation({
 label:"Mot central (flou)",description:"La vidéo se floute et s'assombrit brièvement, un mot important apparaît en très grand au centre, avec une petite amorce au-dessus et un court complément dessous, puis l'image revient. Pour une idée forte, une objection ou une conclusion ; une fois ou deux par Reel.",lengthMs:2200,
 props:z.strictObject({
  mot:z.string().trim().min(1).max(20),
  amorce:z.string().trim().max(30).optional(),
  complement:z.string().trim().max(40).optional(),
  flou:z.enum(["douce","moyenne","forte"]).default("moyenne"),
 }),
 example:{amorce:"Ce qui compte",mot:"CONFIANCE",complement:"avant tout le reste"},
 css:`.anim-mot-central { position:absolute; inset:0; }
 .anim-mot-central .voile { position:absolute; inset:0; opacity:0; }
 .anim-mot-central .bloc { position:absolute; left:90px; right:90px; top:0; bottom:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:${COLORS.white}; }
 .anim-mot-central .amorce { margin:0 0 10px; font-size:40px; font-weight:500; opacity:0; }
 .anim-mot-central .mot { margin:0; font-weight:800; line-height:1; text-transform:uppercase; letter-spacing:-0.01em; opacity:0; text-shadow:0 6px 30px rgba(0,0,0,0.35); }
 .anim-mot-central .complement { margin:18px 0 0; padding:10px 24px; border-radius:999px; background:${COLORS.blue}; font-size:36px; font-weight:600; opacity:0; }`,
 render:(c,p)=>{
  const v=VOILE[p.flou], k=intensityOf(c);
  const size=Math.min(190,Math.floor(880/(0.68*Math.max(4,p.mot.length))));
  const out=exitAt(c,0.25), entry=Math.min(0.25,c.duration/4);
  return {
   html:`<div id="${c.id}" class="anim-mot-central"><div id="${c.id}-v" class="voile" style="backdrop-filter:blur(${v.blur}px) brightness(${v.dim});-webkit-backdrop-filter:blur(${v.blur}px) brightness(${v.dim});background:rgba(0,0,0,${r2((1-v.dim)*0.35)})"></div><div class="bloc">${p.amorce?`<p id="${c.id}-a" class="amorce">${escapeHtml(p.amorce)}</p>`:""}<p id="${c.id}-m" class="mot" style="font-size:${size}px">${escapeHtml(p.mot)}</p>${p.complement?`<p id="${c.id}-c" class="complement">${escapeHtml(p.complement)}</p>`:""}</div></div>`,
   tweens:[
    `tl.to("#${c.id}-v", { opacity: 1, duration: ${r2(entry)}, ease: "power2.out" }, ${r2(c.start)});`,
    ...(p.amorce?[`tl.fromTo("#${c.id}-a", { opacity: 0, y: ${r2(-12*k)} }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, ${r2(c.start+0.08)});`]:[]),
    `tl.fromTo("#${c.id}-m", { opacity: 0, scale: ${r2(1-0.12*k)} }, { opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" }, ${r2(c.start+0.12)});`,
    ...(p.complement?[`tl.fromTo("#${c.id}-c", { opacity: 0, y: ${r2(14*k)} }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, ${r2(c.start+0.32)});`]:[]),
    `tl.to("#${c.id}-v", { opacity: 0, duration: 0.25, ease: "power2.in" }, ${out});`,
    ...["a","m","c"].filter((x)=>x==="m"||(x==="a"&&p.amorce)||(x==="c"&&p.complement)).map((x)=>`tl.to("#${c.id}-${x}", { opacity: 0, duration: 0.22, ease: "power2.in" }, ${out});`),
   ],
  };
 },
});
