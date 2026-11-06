"use client";
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { PlacementSchema } from '@/domain/social/montage/edit';
import type { CustomAnimation } from '@/domain/social/montage/suggest';
import type { ReelPreviewHandle } from '@/components/social/ReelPreview';
type Bounds={x:number;y:number;width:number;height:number};
type Drag={startX:number;startY:number;resize:boolean;ratio:number;original:CustomAnimation;bounds:Bounds;next:CustomAnimation};
/** Commit a pointer gesture once. Rebuilding the player during pointer capture loses its handles. */
export default function StudioCanvas({children,animation,index,disabled,onChange,player,time}:{children:ReactNode;animation:CustomAnimation|null;index:number;disabled:boolean;onChange:(a:CustomAnimation)=>void;player:React.RefObject<ReelPreviewHandle|null>;time:number|null}) {
 const host=useRef<HTMLDivElement>(null);
 const [bounds,setBounds]=useState<Bounds|null>(null);
 const drag=useRef<Drag|null>(null);
 useEffect(()=>{if(!animation){setBounds(null);return;}const sample=()=>{if(!drag.current)setBounds(player.current?.bounds(index)??null);};sample();const t=setInterval(sample,250);return()=>clearInterval(t);},[animation,index,player,time]);
 const p=PlacementSchema.parse(animation?.placement??{});
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
 const start=(e:PointerEvent<HTMLButtonElement>,resize:boolean)=>{
  if(!animation||!bounds||disabled)return;
  e.currentTarget.setPointerCapture(e.pointerId);player.current?.pause();
  drag.current={startX:e.clientX,startY:e.clientY,resize,original:animation,next:animation,bounds,ratio:1080/(host.current?.getBoundingClientRect().width||1080)};
 };
 const move=(e:PointerEvent<HTMLButtonElement>)=>{
  const d=drag.current;if(!d)return;
  const original=PlacementSchema.parse(d.original.placement??{}),dx=(e.clientX-d.startX)*d.ratio,dy=(e.clientY-d.startY)*d.ratio;
  const placement=d.resize?{...original,scale:clamp(original.scale+dx/800,.25,2)}:{...original,x:Math.round(clamp(original.x+dx,-1080,1080)),y:Math.round(clamp(original.y+dy,-1920,1920))};
  d.next={...d.original,placement};
  player.current?.previewPlacement(index,placement);
  const scale=placement.scale/original.scale;
  setBounds(player.current?.bounds(index)??(d.resize?{x:d.bounds.x+(d.bounds.width-d.bounds.width*scale)/2,y:d.bounds.y+(d.bounds.height-d.bounds.height*scale)/2,width:d.bounds.width*scale,height:d.bounds.height*scale}:{...d.bounds,x:d.bounds.x+placement.x-original.x,y:d.bounds.y+placement.y-original.y}));
 };
 const finish=(cancel=false)=>{const d=drag.current;if(!d)return;drag.current=null;if(cancel){setBounds(d.bounds);player.current?.previewPlacement(index,PlacementSchema.parse(d.original.placement??{}));}else onChange(d.next);};
 return <div ref={host} className="relative mx-auto aspect-[9/16] h-full max-h-full max-w-full" data-testid="studio-canvas">{children}
  {animation&&bounds&&!disabled?<div className="pointer-events-none absolute border-2 border-brand" style={{left:`${bounds.x/10.8}%`,top:`${bounds.y/19.2}%`,width:`${bounds.width/10.8}%`,height:`${bounds.height/19.2}%`}}>
   <button type="button" aria-label="Déplacer l’animation dans l’aperçu" className="pointer-events-auto absolute inset-0 min-h-[44px] min-w-[44px] cursor-move touch-none bg-transparent focus:outline focus:outline-2 focus:outline-white" onKeyDown={e=>{if(e.key==='Escape'){finish(true);return;}const dx=e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0,dy=e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0;if(dx||dy){e.preventDefault();onChange({...animation,placement:{...p,x:clamp(p.x+dx,-1080,1080),y:clamp(p.y+dy,-1920,1920)}});}}}
    onPointerDown={e=>start(e,false)} onPointerMove={move} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}/>
   <button type="button" aria-label="Redimensionner l’animation dans l’aperçu" className="pointer-events-auto absolute -bottom-5 -right-5 h-11 w-11 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-brand text-white" onPointerDown={e=>start(e,true)} onPointerMove={move} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)} onKeyDown={e=>{if(e.key==='Escape'){finish(true);return;}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();onChange({...animation,placement:{...p,scale:clamp(p.scale+(e.key==='ArrowRight'?.05:-.05),.25,2)}});}}}>↔</button>
  </div>:null}
 </div>;
}
