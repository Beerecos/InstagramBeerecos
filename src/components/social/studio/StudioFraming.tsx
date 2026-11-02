"use client";
import type { Edit } from '@/domain/social/montage/edit';
export default function StudioFraming({edit,disabled,onPreview}:{edit:Edit;disabled:boolean;onPreview:(framing:Edit['framing'])=>void}) {
 const value=edit.framing??{x:0,y:0,scale:1};
 const update=(next:typeof value)=>{onPreview(next);};
 return <fieldset disabled={disabled} className="space-y-3">
  <legend className="mb-2 font-semibold">Centrer le personnage</legend>
  <p className="text-xs text-mut">Déplacez l’image dans le cadre. Augmentez le zoom si un bord noir apparaît. Le cadrage s’applique aussi à la vidéo exportée. Enregistrez la modification après vérification.</p>
  <div className="grid grid-cols-4 gap-1" role="group" aria-label="Déplacer la vidéo">
   {([['x',-40,'←','Déplacer la vidéo à gauche'],['y',-40,'↑','Déplacer la vidéo vers le haut'],['y',40,'↓','Déplacer la vidéo vers le bas'],['x',40,'→','Déplacer la vidéo à droite']] as const).map(([axis,delta,arrow,label])=><button key={label} type="button" aria-label={label} title={label} className="btn-ghost min-h-[44px]" onClick={()=>update({...value,[axis]:Math.max(axis==='x'?-540:-960,Math.min(axis==='x'?540:960,value[axis]+delta))})}>{arrow}</button>)}
  </div>
  {([['x','Position horizontale de la vidéo',-540,540,10],['y','Position verticale de la vidéo',-960,960,10],['scale','Zoom de la vidéo',1,2,.05]] as const).map(([key,label,min,max,step])=><label key={key} className="block text-xs">{label} · {key==='scale'?`${Math.round(value[key]*100)} %`:`${value[key]} px`}
   <input className="w-full" type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>update({...value,[key]:Number(e.target.value)})}/>
  </label>)}
  <button type="button" className="btn-ghost min-h-[44px] text-xs" onClick={()=>update({x:0,y:0,scale:1})}>Réinitialiser le cadrage</button>
 </fieldset>;
}
