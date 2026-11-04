"use client";
import { useState } from 'react';
import { ANIMATIONS } from '@/domain/social/montage/registry';
import { PlacementSchema, type Range } from '@/domain/social/montage/edit';
import { fieldsOf, type CustomAnimation } from '@/domain/social/montage/suggest';
/** Libellés des choix fermés (couleur, position, entrée) ; la valeur technique reste celle de l'animation. */
const CHOICES:Record<string,string>={haut:'Derrière la tête',milieu:'Derrière les épaules',blanc:'Blanc',bleu:'Bleu BeeRecos',noir:'Noir',flou:'Fondu flou',rebond:'Agrandissement avec rebond',verticale:'Entrée verticale',laterale:'Entrée latérale'};
import { animationOutputRange, retimeAnimation } from '@/domain/social/montage/placement';
const field='mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm';
const labels:Record<string,string>={texte:'Texte',detail:'Ligne secondaire',mot:'Mot-clé',valeur:'Nombre',legende:'Légende',titre:'Titre',items:'Points',position:'Position',couleur:'Couleur',entree:'Entrée'};
export default function StudioInspector({animation,ranges,disabled,onChange,onRemove,onTest}:{animation:CustomAnimation|null;ranges:Range[];disabled:boolean;onChange:(a:CustomAnimation)=>void;onRemove:()=>void;onTest:()=>void}) {
 const [error,setError]=useState<string|null>(null);
 if(!animation) return <section aria-label="Réglages de l’animation" className="space-y-3"><h3 className="font-semibold">Réglages</h3><p className="text-sm text-mut">Sélectionnez une carte dans la timeline pour régler son texte, sa position et son mouvement.</p></section>;
 const a=animation,p=PlacementSchema.parse(a.placement??{}),span=animationOutputRange(a,ranges),def=ANIMATIONS[a.name];
 const move=(key:string,value:unknown)=>onChange({...a,placement:{...p,[key]:value}});
 const timing=(from:number,to:number)=>{try{onChange(retimeAnimation(a,ranges,from,to));setError(null);}catch(e){setError((e as Error).message);}};
 return <section aria-label="Réglages de l’animation" className="space-y-3">
  <h3 className="font-semibold">{def?.label??a.name}</h3>
  <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
   {def?fieldsOf(def).map(f=><label key={f.key} className="block text-xs font-medium">{labels[f.key]??f.key}{f.kind==='choice'?<select className={field} value={String(a.props[f.key]??'')} onChange={e=>onChange({...a,props:{...a.props,[f.key]:e.target.value}})}>{f.optional?<option value=''>Par défaut</option>:null}{(f.options??[]).map(o=><option key={o} value={o}>{CHOICES[o]??o}</option>)}</select>:f.kind==='list'?<textarea className={field} value={Array.isArray(a.props[f.key])?(a.props[f.key] as unknown[]).join('\n'):String(a.props[f.key]??'')} onChange={e=>onChange({...a,props:{...a.props,[f.key]:e.target.value.split('\n')}})}/>:<input className={field} type={f.kind==='number'?'number':'text'} value={String(a.props[f.key]??'')} onChange={e=>onChange({...a,props:{...a.props,[f.key]:f.kind==='number'?Number(e.target.value):e.target.value}})}/>}</label>):null}
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Début monté (s)<input className={field} type="number" min="0" step="0.1" value={span.fromMs/1000} onChange={e=>timing(Number(e.target.value)*1000,span.toMs)}/></label>
    <label className="text-xs">Durée (s)<input className={field} type="number" min="0.1" step="0.1" value={(span.toMs-span.fromMs)/1000} onChange={e=>timing(span.fromMs,span.fromMs+Number(e.target.value)*1000)}/></label>
   </div>
   {([['x','Position horizontale',-1080,1080,1],['y','Position verticale',-1920,1920,1],['scale','Taille',.25,2,.05],['opacity','Opacité',0,1,.05]] as const).map(([key,label,min,max,step])=><label key={key} className="block text-xs">{label}<input className={field} type="number" min={min} max={max} step={step} value={p[key]} onChange={e=>{const value=e.target.valueAsNumber;if(Number.isFinite(value))move(key,Math.max(min,Math.min(max,value)));}}/></label>)}
   <label className="block text-xs">Entrée<select className={field} value={p.enter} onChange={e=>move('enter',e.target.value)}><option value="native">Mouvement de l’animation</option><option value="fade">Apparition douce</option>{a.name!=='logo-fin'?<option value="slide">Glissement</option>:null}</select></label>
   <label className="block text-xs">Sortie<select className={field} value={p.exit} onChange={e=>move('exit',e.target.value)}><option value="none">Mouvement de l’animation</option><option value="fade">Disparition douce</option></select></label>
   <div className="flex flex-wrap gap-2"><button className="btn-ghost min-h-[44px]" type="button" onClick={onTest}>Tester cette animation</button><button className="btn-ghost min-h-[44px]" type="button" onClick={onRemove}>Retirer la carte</button></div>
  </fieldset>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
 </section>;
}
