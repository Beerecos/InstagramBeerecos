"use client";
/**
 * Cadrage de la prise dans le 9:16. Prise paysage (ou plus haute que le 9:16) : l'image entière est montrée avec une
 * fenêtre 9:16 à faire glisser pour choisir la partie gardée (`focusX` / `focusY`) ; le zoom resserre la fenêtre.
 * Le même cadrage sert à l'aperçu et au MP4 (même composition).
 */
import { useRef, useState } from 'react';
import type { Edit } from '@/domain/social/montage/edit';

type Framing = NonNullable<Edit['framing']>;
const TARGET = 9 / 16;

export default function StudioFraming({edit,disabled,onPreview,videoUrl=null}:{edit:Edit;disabled:boolean;onPreview:(framing:Edit['framing'])=>void;videoUrl?:string|null}) {
 const value:Framing={x:0,y:0,scale:1,...edit.framing};
 const update=(next:Framing)=>{onPreview(next);};
 const [aspect,setAspect]=useState<number|null>(null);
 const box=useRef<HTMLDivElement>(null);
 const drag=useRef<{startX:number;startY:number;fx:number;fy:number}|null>(null);
 const wide=aspect!==null&&aspect>TARGET+0.01, tall=aspect!==null&&aspect<TARGET-0.01;
 // Taille de la fenêtre gardée, en part de l'image source (cover dans 1080×1920, puis zoom).
 const winW=wide?Math.min(1,TARGET/aspect!/value.scale):1/value.scale;
 const winH=tall?Math.min(1,aspect!/TARGET/value.scale):1/value.scale;
 const fx=value.focusX??50, fy=value.focusY??50;
 const left=(1-winW)*fx, top=(1-winH)*fy;
 const move=(e:React.PointerEvent)=>{const d=drag.current,el=box.current;if(!d||!el)return;const r=el.getBoundingClientRect();
  const nx=winW<1?Math.max(0,Math.min(100,d.fx+(e.clientX-d.startX)/(r.width*(1-winW))*100)):50;
  const ny=winH<1?Math.max(0,Math.min(100,d.fy+(e.clientY-d.startY)/(r.height*(1-winH))*100)):50;
  update({...value,focusX:Math.round(nx),focusY:Math.round(ny)});};
 return <fieldset disabled={disabled} className="space-y-3">
  <legend className="mb-2 font-semibold">Recadrer en 9:16</legend>
  {videoUrl?<video src={`${videoUrl}#t=0.5`} preload="metadata" muted playsInline className="hidden" aria-hidden onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setAspect(v.videoWidth/v.videoHeight);}}/>:null}
  {aspect!==null&&(wide||tall||value.scale>1)?<>
   <p className="text-xs text-mut">{wide?"Prise en paysage : fais glisser la fenêtre sur la partie à garder (toi, ton invité…).":tall?"Prise plus haute que le 9:16 : fais glisser la fenêtre de haut en bas.":"Fais glisser la fenêtre zoomée sur la partie à garder."}</p>
   <div ref={box} data-testid="framing-source" className="relative w-full overflow-hidden rounded-lg bg-black" style={{aspectRatio:String(aspect)}}>
    {videoUrl?<video src={`${videoUrl}#t=0.5`} preload="metadata" muted playsInline aria-hidden className="absolute inset-0 h-full w-full object-contain opacity-60"/>:null}
    <div role="slider" tabIndex={0} aria-label="Partie de l'image gardée" aria-valuemin={0} aria-valuemax={100} aria-valuenow={wide?fx:fy} aria-valuetext={`${wide?fx:fy} %`}
     data-testid="framing-window" className="absolute cursor-grab touch-none rounded border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] active:cursor-grabbing"
     style={{left:`${left}%`,top:`${top}%`,width:`${winW*100}%`,height:`${winH*100}%`}}
     onPointerDown={e=>{if(disabled)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={startX:e.clientX,startY:e.clientY,fx,fy};}}
     onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
     onKeyDown={e=>{const step=e.shiftKey?10:2;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();update({...value,focusX:Math.max(0,Math.min(100,fx+(e.key==='ArrowRight'?step:-step)))});}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();update({...value,focusY:Math.max(0,Math.min(100,fy+(e.key==='ArrowDown'?step:-step)))});}}}/>
   </div>
   {wide?<label className="block text-xs">Partie gardée (gauche → droite) · {fx} %<input className="w-full" type="range" min={0} max={100} step={1} value={fx} onChange={e=>update({...value,focusX:Number(e.target.value)})}/></label>:null}
   {tall||value.scale>1?<label className="block text-xs">Partie gardée (haut → bas) · {fy} %<input className="w-full" type="range" min={0} max={100} step={1} value={fy} onChange={e=>update({...value,focusY:Number(e.target.value)})}/></label>:null}
  </>:<p className="text-xs text-mut">{videoUrl&&aspect===null?"Lecture du format de la prise…":"Prise déjà au format 9:16 : le zoom permet de resserrer le plan."}</p>}
  <label className="block text-xs">Zoom · {Math.round(value.scale*100)} %<input className="w-full" type="range" min={1} max={2} step={.05} value={value.scale} onChange={e=>update({...value,scale:Number(e.target.value)})}/></label>
  <details className="text-xs"><summary className="cursor-pointer text-mut">Décalage fin (peut faire apparaître des bords noirs)</summary>
   {([['x','Position horizontale de la vidéo',-540,540,10],['y','Position verticale de la vidéo',-960,960,10]] as const).map(([key,label,min,max,step])=><label key={key} className="mt-2 block">{label} · {value[key]} px
    <input className="w-full" type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>update({...value,[key]:Number(e.target.value)})}/>
   </label>)}
  </details>
  <p className="text-xs text-mut">Le cadrage s’applique aussi à la vidéo exportée. Enregistre la modification après vérification dans l’aperçu.</p>
  <button type="button" className="btn-ghost min-h-[44px] text-xs" onClick={()=>update({x:0,y:0,scale:1,focusX:50,focusY:50})}>Réinitialiser le cadrage</button>
 </fieldset>;
}
