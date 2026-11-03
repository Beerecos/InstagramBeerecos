import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { escapeHtml, fadeOut, r2 } from "../fx";

/** Pictogrammes simples (trait blanc sur pastille bleue), dessinés pour BeeRecos. */
const ICONS = {
 reseau:`<circle cx="32" cy="16" r="7"/><circle cx="14" cy="46" r="7"/><circle cx="50" cy="46" r="7"/><path d="M28 22 L17 40 M36 22 L47 40 M21 46 L43 46"/>`,
 message:`<path d="M10 14 H54 V40 H30 L18 52 V40 H10 Z"/>`,
 idee:`<path d="M32 8 C20 8 14 18 16 28 C18 36 24 38 24 46 H40 C40 38 46 36 48 28 C50 18 44 8 32 8 Z M26 54 H38"/>`,
 agenda:`<rect x="10" y="14" width="44" height="40" rx="5"/><path d="M10 26 H54 M22 8 V18 M42 8 V18"/>`,
 cible:`<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="3"/>`,
 graphique:`<path d="M10 54 H54 M16 46 V34 M28 46 V24 M40 46 V30 M52 46 V12"/>`,
 poignee:`<path d="M6 30 L18 20 L30 26 L40 20 L58 30 M18 34 L30 46 C33 49 37 47 36 43 L40 46 C43 49 47 46 45 42 L48 44 C51 46 54 42 51 39 L40 30"/>`,
 etoile:`<path d="M32 8 L39 24 L56 25 L43 36 L47 53 L32 44 L17 53 L21 36 L8 25 L25 24 Z"/>`,
} as const;
type Icon = keyof typeof ICONS;
const NAMES = Object.keys(ICONS) as [Icon, ...Icon[]];

/** Icônes bleues qui flottent en perspective autour d'une lueur centrale (et d'un mot optionnel). */
export default defineAnimation({
 label:"Icônes en orbite 3D",description:"Trois à six icônes bleues arrivent du fond et flottent en perspective autour d'une lueur centrale, avec un mot optionnel au centre. Pour illustrer un écosystème, des outils, un réseau.",lengthMs:4000,
 props:z.strictObject({icones:z.array(z.enum(NAMES)).min(3).max(6),centre:z.string().trim().max(20).default("")}),
 example:{icones:["reseau","message","idee","agenda","cible","poignee"],centre:"BeeRecos"},
 css:`.anim-icones-orbite { position:absolute; left:90px; right:170px; top:300px; height:820px; perspective:1400px; }
 .anim-icones-orbite .scene { position:absolute; inset:0; transform-style:preserve-3d; }
 .anim-icones-orbite .lueur { position:absolute; left:50%; top:50%; width:520px; height:520px; margin:-260px 0 0 -260px; border-radius:50%; background:radial-gradient(circle, rgba(120,150,255,0.95) 0%, rgba(40,81,255,0.55) 35%, rgba(40,81,255,0) 70%); }
 .anim-icones-orbite .centre { position:absolute; left:0; right:0; top:50%; margin:-40px 0 0; text-align:center; font-size:68px; font-weight:800; line-height:80px; color:${COLORS.white}; text-shadow:0 6px 20px rgba(0,0,0,0.5); }
 .anim-icones-orbite .icone { position:absolute; width:150px; height:150px; margin:-75px 0 0 -75px; border-radius:34px; background:linear-gradient(145deg, #4d6dff 0%, ${COLORS.blue} 55%, #1a37c4 100%); box-shadow:0 24px 40px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.35); display:flex; align-items:center; justify-content:center; }
 .anim-icones-orbite .icone svg { width:84px; height:84px; fill:none; stroke:${COLORS.white}; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; }`,
 render:(c,p)=>{
  const n=p.icones.length;
  const pos=p.icones.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return {x:Math.round(50+38*Math.cos(a)),y:Math.round(50+40*Math.sin(a)),z:Math.round(140*Math.sin(a+Math.PI/2))};});
  return {
   html:`<div id="${c.id}" class="anim-icones-orbite"><div id="${c.id}-scene" class="scene"><div id="${c.id}-lueur" class="lueur"></div>${p.centre?`<p id="${c.id}-c" class="centre">${escapeHtml(p.centre)}</p>`:""}${p.icones.map((ic,i)=>`<div id="${c.id}-i${i}" class="icone" style="left:${pos[i].x}%; top:${pos[i].y}%;"><svg viewBox="0 0 64 64">${ICONS[ic]}</svg></div>`).join("")}</div></div>`,
   tweens:[
    `tl.fromTo("#${c.id}-lueur", { scale:0.3, opacity:0 }, { scale:1, opacity:1, duration:0.6, ease:"power2.out" }, ${r2(c.start)});`,
    `tl.fromTo("#${c.id}-scene", { rotationX:20, rotationY:-25 }, { rotationX:8, rotationY:20, duration:${r2(Math.max(0.5,c.duration-0.3))}, ease:"sine.inOut" }, ${r2(c.start)});`,
    ...(p.centre?[`tl.fromTo("#${c.id}-c", { opacity:0, scale:0.7 }, { opacity:1, scale:1, duration:0.4, ease:"back.out(2)" }, ${r2(c.start+0.3)});`]:[]),
    ...pos.flatMap((q,i)=>[
     `tl.fromTo("#${c.id}-i${i}", { opacity:0, z:-900, scale:0.4, rotationY:-90 }, { opacity:1, z:${q.z}, scale:1, rotationY:0, duration:0.6, ease:"back.out(1.4)" }, ${r2(c.start+0.2+i*0.12)});`,
     `tl.to("#${c.id}-i${i}", { y:${i%2?-26:26}, duration:${r2(Math.max(0.4,c.duration-1.4))}, ease:"sine.inOut" }, ${r2(c.start+0.9+i*0.12)});`,
    ]),
    fadeOut(c.id,c),
   ],
  };
 },
});
