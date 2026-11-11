import { z } from "zod";
import { defineAnimation } from "../animations";
import { COLORS } from "../brand";
import { SAFE_BLOCK, cardIn, escapeHtml, fadeOut, r2 } from "../fx";

/**
 * Objets d'interface (Studio animations, lot 2, 2026-11-11) : touches, recherche, saisie, bouton, interrupteur,
 * curseur, notification, bulle de conversation. Textes personnalisables, animations de saisie, sélection, activation
 * ou validation. À utiliser quand l'objet correspond à l'action évoquée.
 */
const TYPES = ["touches", "recherche", "saisie", "bouton", "interrupteur", "curseur", "notification", "bulle"] as const;
const TOP = { haut: 330, milieu: 760 } as const;
const CHECK = `<path d="M7 17 l6 6 l12 -13" />`;

export default defineAnimation({
 label:"Objet d'interface",description:"Un élément d'application animé : touches de clavier pressées, barre de recherche ou champ qui se remplit, bouton cliqué, interrupteur activé, curseur réglé, notification qui arrive ou bulle de conversation. Pour illustrer une action concrète (s'inscrire, chercher un club, recevoir une recommandation).",lengthMs:3500,
 props:z.strictObject({
  type:z.enum(TYPES).default("bouton"),
  texte:z.string().trim().min(1).max(40),
  detail:z.string().trim().max(60).optional(),
  position:z.enum(["haut","milieu"]).default("haut"),
 }),
 example:{type:"bouton",texte:"Demander mon invitation"},
 css:`.anim-objet-interface { ${SAFE_BLOCK} display:flex; flex-direction:column; align-items:center; }
 .anim-objet-interface .oi { box-sizing:border-box; box-shadow:0 16px 40px rgba(0,0,0,0.22); }
 .anim-objet-interface .touches { display:flex; gap:18px; box-shadow:none; }
 .anim-objet-interface .touche { min-width:120px; height:120px; padding:0 28px; box-sizing:border-box; border-radius:24px; background:${COLORS.white}; color:${COLORS.black}; font-size:52px; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 0 #C9CFE0, 0 18px 30px rgba(0,0,0,0.25); }
 .anim-objet-interface .champ { width:100%; display:flex; align-items:center; gap:20px; padding:24px 32px; border-radius:999px; background:${COLORS.white}; color:${COLORS.black}; font-size:44px; font-weight:600; min-height:110px; }
 .anim-objet-interface .champ.carre { border-radius:24px; flex-direction:column; align-items:flex-start; gap:8px; }
 .anim-objet-interface .champ .lbl { font-size:28px; font-weight:600; color:${COLORS.blue}; }
 .anim-objet-interface .loupe { flex:none; width:46px; height:46px; }
 .anim-objet-interface .loupe circle, .anim-objet-interface .loupe path { fill:none; stroke:${COLORS.blue}; stroke-width:4; stroke-linecap:round; }
 .anim-objet-interface .caret { display:inline-block; width:4px; height:46px; margin-left:4px; background:${COLORS.blue}; vertical-align:middle; }
 .anim-objet-interface .resultat { margin-top:18px; padding:16px 28px; border-radius:20px; background:${COLORS.white}; color:${COLORS.black}; font-size:36px; font-weight:600; opacity:0; box-shadow:0 10px 26px rgba(0,0,0,0.2); }
 .anim-objet-interface .bouton { position:relative; display:inline-flex; align-items:center; gap:18px; padding:30px 54px; border-radius:999px; background:${COLORS.blue}; color:${COLORS.white}; font-size:46px; font-weight:700; }
 .anim-objet-interface .bouton svg { width:44px; height:44px; }
 .anim-objet-interface svg path { fill:none; stroke:${COLORS.white}; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; }
 .anim-objet-interface .pointeur { position:absolute; right:-26px; bottom:-46px; width:70px; height:70px; }
 .anim-objet-interface .pointeur path { fill:${COLORS.white}; stroke:${COLORS.black}; stroke-width:2.5; }
 .anim-objet-interface .ligne { width:100%; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:28px 34px; border-radius:28px; background:${COLORS.white}; color:${COLORS.black}; font-size:44px; font-weight:600; }
 .anim-objet-interface .switch { flex:none; position:relative; width:150px; height:84px; border-radius:999px; background:#C9CFE0; }
 .anim-objet-interface .knob { position:absolute; left:8px; top:8px; width:68px; height:68px; border-radius:50%; background:${COLORS.white}; box-shadow:0 4px 10px rgba(0,0,0,0.25); }
 .anim-objet-interface .curseur { width:100%; padding:30px 34px 40px; border-radius:28px; background:${COLORS.white}; color:${COLORS.black}; font-size:40px; font-weight:600; }
 .anim-objet-interface .rail { position:relative; margin-top:30px; height:14px; border-radius:999px; background:#E3E7F2; }
 .anim-objet-interface .jauge { position:absolute; left:0; top:0; bottom:0; width:100%; border-radius:999px; background:${COLORS.blue}; transform-origin:0% 50%; transform:scaleX(0.1); }
 .anim-objet-interface .poignee { position:absolute; top:-20px; left:0; width:54px; height:54px; margin-left:-27px; border-radius:50%; background:${COLORS.white}; border:6px solid ${COLORS.blue}; box-sizing:border-box; }
 .anim-objet-interface .notif { width:100%; display:flex; gap:22px; align-items:flex-start; padding:26px 30px; border-radius:30px; background:rgba(255,255,255,0.96); color:${COLORS.black}; }
 .anim-objet-interface .notif .icone { flex:none; width:76px; height:76px; border-radius:18px; background:${COLORS.blue}; color:${COLORS.white}; font-size:40px; font-weight:800; display:flex; align-items:center; justify-content:center; }
 .anim-objet-interface .notif .app { font-size:26px; font-weight:600; color:rgba(0,0,0,0.5); text-transform:uppercase; letter-spacing:0.04em; }
 .anim-objet-interface .notif .t { margin:4px 0 0; font-size:38px; font-weight:700; line-height:1.2; }
 .anim-objet-interface .notif .d { margin:4px 0 0; font-size:32px; font-weight:500; line-height:1.25; color:rgba(0,0,0,0.7); }
 .anim-objet-interface .fil { width:100%; display:flex; flex-direction:column; gap:18px; box-shadow:none; }
 .anim-objet-interface .msg { max-width:78%; padding:22px 30px; border-radius:30px; font-size:40px; font-weight:500; line-height:1.25; box-shadow:0 10px 26px rgba(0,0,0,0.18); }
 .anim-objet-interface .msg.eux { align-self:flex-start; background:${COLORS.white}; color:${COLORS.black}; border-bottom-left-radius:8px; }
 .anim-objet-interface .msg.moi { align-self:flex-end; background:${COLORS.blue}; color:${COLORS.white}; border-bottom-right-radius:8px; }`,
 render:(c,p)=>{
  const id=c.id, t=escapeHtml(p.texte), d=p.detail?escapeHtml(p.detail):"";
  const at=(x:number)=>r2(c.start+x);
  const tw:string[]=[];
  const sfx:{at:number;kind:"clic"|"saisie"|"glisse"}[]=[];
  const typeText=(target:string, text:string, from:number, step=0.08)=>{
   [...text].forEach((_,k)=>{ tw.push(`tl.set("#${target}", { textContent: ${JSON.stringify(text.slice(0,k+1))} }, ${at(from+(k+1)*step)});`); if(k%2===0) sfx.push({at:at(from+(k+1)*step),kind:"saisie"}); });
   return from+text.length*step;
  };
  let html="";
  switch(p.type){
   case "touches":{
    const keys=p.texte.split(/\s+/).slice(0,4);
    html=`<div id="${id}-o" class="oi touches">${keys.map((k,i)=>`<span id="${id}-k${i}" class="touche">${escapeHtml(k)}</span>`).join("")}</div>`;
    tw.push(cardIn(`${id}-o`,c.start,c));
    keys.forEach((_,i)=>{ const when=at(0.45+i*0.32); tw.push(`tl.to("#${id}-k${i}", { y: 8, boxShadow: "0 2px 0 #C9CFE0, 0 6px 12px rgba(0,0,0,0.25)", backgroundColor: "#EEF1FF", duration: 0.08, ease: "power2.in" }, ${when});`,`tl.to("#${id}-k${i}", { y: 0, boxShadow: "0 10px 0 #C9CFE0, 0 18px 30px rgba(0,0,0,0.25)", backgroundColor: "${COLORS.white}", duration: 0.12, ease: "power2.out" }, ${r2(when+0.12)});`); sfx.push({at:when,kind:"clic"}); });
    break;
   }
   case "recherche":
   case "saisie":{
    const search=p.type==="recherche";
    html=`<div id="${id}-o" class="oi champ${search?"":" carre"}">${search?`<svg class="loupe" viewBox="0 0 48 48"><circle cx="20" cy="20" r="13" /><path d="M30 30 l12 12" /></svg>`:`<span class="lbl">${d||"Votre réponse"}</span>`}<span><span id="${id}-t"></span><span id="${id}-u" class="caret"></span></span></div>${search&&d?`<div id="${id}-r" class="resultat">${d}</div>`:""}`;
    tw.push(cardIn(`${id}-o`,c.start,c));
    const end=typeText(`${id}-t`,p.texte,0.35);
    tw.push(`tl.to("#${id}-u", { opacity: 0, duration: 0.05, ease: "none" }, ${at(end+0.2)});`);
    if(search&&d){ tw.push(`tl.fromTo("#${id}-r", { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.24, ease: "power3.out" }, ${at(end+0.3)});`); sfx.push({at:at(end+0.3),kind:"glisse"}); }
    break;
   }
   case "bouton":{
    html=`<div id="${id}-o" class="oi bouton"><span>${t}</span><svg id="${id}-v" viewBox="0 0 32 32" style="opacity:0;width:0">${CHECK}</svg><svg id="${id}-p" class="pointeur" viewBox="0 0 32 32"><path d="M6 3 L6 25 L12 19 L16 29 L20 27 L16 18 L24 18 Z" /></svg></div>`;
    const click=at(0.9);
    tw.push(cardIn(`${id}-o`,c.start,c),
     `tl.fromTo("#${id}-p", { x: 120, y: 120, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, ${at(0.3)});`,
     `tl.to("#${id}-o", { scale: 0.94, duration: 0.08, ease: "power2.in" }, ${click});`,
     `tl.to("#${id}-o", { scale: 1, duration: 0.18, ease: "back.out(3)" }, ${r2(click+0.08)});`,
     `tl.to("#${id}-v", { opacity: 1, width: 44, duration: 0.2, ease: "power2.out" }, ${r2(click+0.12)});`);
    sfx.push({at:click,kind:"clic"});
    break;
   }
   case "interrupteur":{
    html=`<div id="${id}-o" class="oi ligne"><span>${t}</span><span id="${id}-s" class="switch"><span id="${id}-n" class="knob"></span></span></div>`;
    const on=at(0.8);
    tw.push(cardIn(`${id}-o`,c.start,c),`tl.to("#${id}-s", { backgroundColor: "${COLORS.blue}", duration: 0.2, ease: "none" }, ${on});`,`tl.to("#${id}-n", { x: 66, duration: 0.24, ease: "back.out(1.8)" }, ${on});`);
    sfx.push({at:on,kind:"clic"});
    break;
   }
   case "curseur":{
    html=`<div id="${id}-o" class="oi curseur">${t}<div class="rail"><span id="${id}-j" class="jauge"></span><span id="${id}-h" class="poignee"></span></div></div>`;
    tw.push(cardIn(`${id}-o`,c.start,c),`tl.fromTo("#${id}-j", { scaleX: 0.1 }, { scaleX: 0.85, duration: 0.9, ease: "power2.inOut" }, ${at(0.45)});`,`tl.fromTo("#${id}-h", { left: "10%" }, { left: "85%", duration: 0.9, ease: "power2.inOut" }, ${at(0.45)});`);
    break;
   }
   case "notification":{
    html=`<div id="${id}-o" class="oi notif"><span class="icone">B</span><div><div class="app">BeeRecos · maintenant</div><p class="t">${t}</p>${d?`<p class="d">${d}</p>`:""}</div></div>`;
    tw.push(`tl.fromTo("#${id}-o", { y: -160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "back.out(1.4)" }, ${at(0)});`);
    sfx.push({at:at(0),kind:"glisse"});
    break;
   }
   case "bulle":{
    html=`<div id="${id}-o" class="oi fil"><div id="${id}-a" class="msg eux">${t}</div>${d?`<div id="${id}-b" class="msg moi">${d}</div>`:""}</div>`;
    tw.push(`tl.fromTo("#${id}-a", { opacity: 0, y: 24, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "back.out(1.6)" }, ${at(0)});`);
    sfx.push({at:at(0),kind:"glisse"});
    if(d){ tw.push(`tl.fromTo("#${id}-b", { opacity: 0, y: 24, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "back.out(1.6)" }, ${at(1.1)});`); sfx.push({at:at(1.1),kind:"glisse"}); }
    break;
   }
  }
  tw.push(fadeOut(id,c,0.25));
  return { html:`<div id="${id}" class="anim-objet-interface" style="top:${TOP[p.position]}px">${html}</div>`, tweens:tw, sfx };
 },
});
