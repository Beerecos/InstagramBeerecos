import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { escapeHtml, fadeOut, r2 } from "../fx";

const PUFFS = [[-220,0],[-120,30],[0,40],[120,30],[220,0],[-300,-40],[300,-40],[-60,60],[60,60]];

/** Fusée qui tremble, s'allume et décolle dans un nuage de fumée. Illustration plein écran. */
export default defineAnimation({
 label:"Fusée qui décolle",description:"Une fusée stylisée tremble, s'allume et décolle dans un nuage de fumée, avec un texte optionnel en haut. Illustration plein écran pour un lancement, une accélération.",lengthMs:3000,
 props:z.strictObject({texte:z.string().trim().max(24).default(""),fond:z.boolean().default(true)}),
 example:{texte:"C'est parti !",fond:true},
 css:`.anim-fusee-decollage { position:absolute; inset:0; overflow:hidden; }
 .anim-fusee-decollage.fond { background:linear-gradient(180deg, #0b1440 0%, #1b2a6b 60%, #3a4fa8 100%); }
 .anim-fusee-decollage .fusee { position:absolute; left:50%; bottom:560px; width:220px; margin-left:-110px; }
 .anim-fusee-decollage .flamme { transform-origin:50% 0%; }
 .anim-fusee-decollage .fumee { position:absolute; left:50%; bottom:470px; width:0; height:0; }
 .anim-fusee-decollage .puff { position:absolute; width:200px; height:200px; margin:-100px 0 0 -100px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(220,226,245,0.8) 55%, rgba(220,226,245,0) 72%); }
 .anim-fusee-decollage .texte { position:absolute; left:90px; right:170px; top:300px; margin:0; text-align:center; font-size:84px; font-weight:900; color:${COLORS.white}; text-transform:uppercase; text-shadow:0 8px 24px rgba(0,0,0,0.5); }`,
 render:(c,p)=>{
  const go=c.start+c.duration*0.35;
  return {
   html:`<div id="${c.id}" class="anim-fusee-decollage${p.fond?" fond":""}"><div class="fumee">${PUFFS.map(([x,y],i)=>`<div id="${c.id}-p${i}" class="puff" style="left:${x}px; top:${y}px;"></div>`).join("")}</div><svg id="${c.id}-fusee" class="fusee" viewBox="0 0 220 440"><path id="${c.id}-flamme" class="flamme" d="M80 360 Q110 470 140 360 Z" fill="#FFB020"/><path d="M110 10 C170 70 175 190 160 330 L60 330 C45 190 50 70 110 10 Z" fill="${COLORS.white}"/><path d="M110 10 C140 40 155 80 160 120 L60 120 C65 80 80 40 110 10 Z" fill="${COLORS.blue}"/><circle cx="110" cy="190" r="30" fill="${COLORS.blue}" stroke="#d9def0" stroke-width="10"/><path d="M60 250 L15 340 L60 330 Z M160 250 L205 340 L160 330 Z" fill="${COLORS.blue}"/></svg>${p.texte?`<p id="${c.id}-t" class="texte">${escapeHtml(p.texte)}</p>`:""}</div>`,
   tweens:[
    `tl.fromTo("#${c.id}", { opacity:0 }, { opacity:1, duration:0.2, ease:"none" }, ${r2(c.start)});`,
    `tl.fromTo("#${c.id}-flamme", { scaleY:0 }, { scaleY:1, duration:0.3, ease:"power2.out" }, ${r2(go-0.4)});`,
    ...[0,1,2,3].map(i=>`tl.to("#${c.id}-fusee", { x:${i%2?-6:6}, duration:0.05, ease:"none" }, ${r2(go-0.3+i*0.06)});`),
    `tl.to("#${c.id}-fusee", { x:0, y:-1900, duration:1.1, ease:"power3.in" }, ${r2(go)});`,
    `tl.to("#${c.id}-flamme", { scaleY:1.8, duration:0.4, ease:"power1.out" }, ${r2(go)});`,
    ...PUFFS.map(([x],i)=>`tl.fromTo("#${c.id}-p${i}", { scale:0, opacity:0 }, { scale:${r2(1.4+(i%3)*0.4)}, opacity:1, x:${Math.round(x*0.8)}, duration:0.9, ease:"power2.out" }, ${r2(go-0.1+(i%4)*0.06)});`),
    ...(p.texte?[`tl.fromTo("#${c.id}-t", { opacity:0, scale:0.6 }, { opacity:1, scale:1, duration:0.4, ease:"back.out(2)" }, ${r2(go+0.4)});`]:[]),
    fadeOut(c.id,c),
   ],
  };
 },
});
