import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { fadeOut, r2 } from "../fx";

const BRANCHES = ["M300 760 C300 640 296 540 300 420","M300 560 C250 520 210 480 180 420","M300 520 C350 480 390 440 420 380","M300 460 C270 400 250 350 240 300","M300 440 C330 380 350 330 370 280","M300 420 C300 360 300 300 300 240"];
const LEAVES: [number, number, number][] = [[180,400,70],[150,340,55],[240,280,75],[300,220,85],[370,260,75],[430,350,65],[420,290,50],[220,350,55],[360,340,60],[300,300,70],[260,220,50],[350,200,55]];
const PALETTES = { bleu:[COLORS.blue,"#4d6dff","#8fb0ff"], vert:[COLORS.green,"#2aa39c","#7fe0d9"], mix:[COLORS.blue,COLORS.green,COLORS.violet] } as const;

/** Arbre qui pousse : le tronc et les branches se dessinent, puis le feuillage éclot. */
export default defineAnimation({
 label:"Arbre qui pousse",description:"Un arbre se dessine du tronc vers les branches, puis son feuillage coloré éclot touffe par touffe, en légère perspective. Pour la croissance, le développement, un réseau qui grandit.",lengthMs:3500,
 props:z.strictObject({feuillage:z.enum(["bleu","vert","mix"]).default("mix")}),
 example:{feuillage:"mix"},
 css:`.anim-arbre-pousse { position:absolute; left:90px; right:170px; top:420px; height:800px; perspective:1400px; }
 .anim-arbre-pousse svg { position:absolute; left:50%; top:0; width:600px; height:800px; margin-left:-300px; overflow:visible; transform:rotateY(-12deg); }
 .anim-arbre-pousse .branche { fill:none; stroke:#5a3d22; stroke-linecap:round; stroke-dasharray:1; stroke-dashoffset:1; }
 .anim-arbre-pousse .feuille { opacity:0.95; }`,
 render:(c,p)=>{
  const pal=PALETTES[p.feuillage];
  const grow=c.duration*0.35;
  return {
   html:`<div id="${c.id}" class="anim-arbre-pousse"><svg viewBox="0 0 600 800"><ellipse cx="300" cy="765" rx="160" ry="22" fill="rgba(0,0,0,0.35)"/>${LEAVES.map(([x,y,r],i)=>`<circle id="${c.id}-f${i}" class="feuille" cx="${x}" cy="${y}" r="${r}" fill="${pal[i%pal.length]}"/>`).join("")}${BRANCHES.map((d,i)=>`<path id="${c.id}-b${i}" class="branche" pathLength="1" stroke-width="${i===0?34:16-i}" d="${d}"/>`).join("")}</svg></div>`,
   tweens:[
    `tl.fromTo("#${c.id}", { opacity:0 }, { opacity:1, duration:0.2, ease:"none" }, ${r2(c.start)});`,
    ...BRANCHES.map((_,i)=>`tl.to("#${c.id}-b${i}", { strokeDashoffset:0, duration:${r2(i===0?grow*0.6:grow*0.5)}, ease:"power2.out" }, ${r2(c.start+(i===0?0:grow*0.4+i*0.07))});`),
    ...LEAVES.map((_,i)=>`tl.fromTo("#${c.id}-f${i}", { scale:0, transformOrigin:"50% 50%" }, { scale:1, duration:0.4, ease:"back.out(2)" }, ${r2(c.start+grow+0.1+i*0.05)});`),
    fadeOut(c.id,c),
   ],
  };
 },
});
