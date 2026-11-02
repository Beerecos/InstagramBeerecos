import { z } from "zod";
import { defineAnimation, titleLines } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, fadeOut, r2 } from "../fx";

export default defineAnimation({
 label:"Mot impact",description:"Un très grand mot ou titre blanc arrive avec un léger zoom, sans cartouche. Pour une question ou une idée forte au premier plan ; la version derrière demande un détourage.",lengthMs:2500,
 props:z.strictObject({texte:z.string().trim().min(1).max(48)}),example:{texte:"POURQUOI ?"},
 css:`.anim-mot-impact { ${SAFE_BLOCK} top:320px; color:${COLORS.white}; text-align:center; font-weight:700; line-height:1; text-shadow:0 4px 24px rgba(0,0,0,0.6); }
 .anim-mot-impact p { margin:0; text-transform:uppercase; }`,
 render:(c,p)=>{
  const lines=titleLines(p.texte.toUpperCase());const size=Math.min(160,Math.floor(800/(0.7*Math.max(...lines.map(l=>l.length)))));
  return {html:`<div id="${c.id}" class="anim-mot-impact" style="font-size:${size}px">${lines.map(t=>`<p>${escapeHtml(t)}</p>`).join("")}</div>`,tweens:[`tl.fromTo("#${c.id}", { scale:0.88, opacity:0 }, { scale:1, opacity:1, duration:${Math.min(0.35,c.duration/3)}, ease:"power3.out" }, ${r2(c.start)});`,fadeOut(c.id,c)]};
 },
});
