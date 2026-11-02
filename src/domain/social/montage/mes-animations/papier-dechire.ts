import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, escapeHtml, slideIn, fadeOut } from "../fx";

export default defineAnimation({
 label: "Papier déchiré", description: "Une à quatre étiquettes à bords irréguliers apparaissent successivement. Pour une idée courte ou une liste, avec inclinaison réglable.", lengthMs: 3500,
 props: z.strictObject({items:z.array(z.string().trim().min(1).max(38)).min(1).max(4),angle:z.number().min(-12).max(12).default(-3)}),
 example:{items:["Temps", "Contacts", "Énergie"],angle:-3},
 css:`.anim-papier-dechire { ${SAFE_BLOCK} top: 360px; display:flex; flex-direction:column; align-items:flex-start; gap:24px; }
 .anim-papier-dechire p { margin:0; max-width:100%; box-sizing:border-box; padding:28px 38px; font-size:48px; line-height:1.25; font-weight:600; overflow-wrap:anywhere; color:${COLORS.black}; background:${COLORS.white}; clip-path:polygon(1% 9%,5% 4%,9% 7%,14% 1%,20% 5%,27% 2%,34% 6%,41% 1%,49% 4%,56% 0%,64% 5%,72% 2%,80% 6%,88% 1%,96% 4%,99% 13%,98% 28%,100% 41%,98% 57%,100% 73%,98% 90%,94% 96%,87% 93%,80% 99%,72% 95%,64% 100%,56% 96%,47% 99%,38% 94%,30% 98%,22% 95%,14% 100%,7% 94%,2% 96%,0% 82%,2% 65%,0% 48%,2% 30%); }`,
 render:(c,p)=>({html:`<div id="${c.id}" class="anim-papier-dechire" style="transform:rotate(${p.angle}deg)">${p.items.map((t,i)=>`<p id="${c.id}-i${i}">${escapeHtml(t)}</p>`).join("")}</div>`,tweens:[...p.items.map((_,i)=>slideIn(`${c.id}-i${i}`,c.start+i*c.duration*0.45/p.items.length,{x:-55,duration:Math.min(0.45,c.duration/4)})),fadeOut(c.id,c)]}),
});
