"use client";
import { useEffect, useRef, useState } from "react";
import { studioAssets } from "@/lib/social/studio-assets-api";
import { parseStudioAssetData, type StudioAsset, type StudioEffect } from "@/domain/social/studio-assets";
import { captureStudioEffect } from "@/domain/social/studio-effect-placement";
import type { CustomAnimation } from "@/domain/social/montage/suggest";
import type { Range } from "@/domain/social/montage/edit";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import ReelPreview from "@/components/social/ReelPreview";
import StudioInspector from "@/components/social/studio/StudioInspector";

type EffectAsset = StudioAsset<"effect">;
type Editor = {asset:EffectAsset|null; title:string; data:StudioEffect; apply:boolean};
const blank = ():StudioEffect => ({schemaVersion:1,durationMs:3000,layers:[{id:crypto.randomUUID(),name:"titre",fromMs:0,toMs:3000,props:{texte:"Mon titre"}}]});
const input = "min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";

/** Versioned personal effects. The preview receipt applies only to the unchanged saved revision. */
export default function StudioEffectLibrary({custom,selected,ranges,disabled,onApply}:{custom:CustomAnimation[];selected:CustomAnimation|null;ranges:Range[];disabled:boolean;onApply:(effect:StudioEffect)=>void}) {
  const [assets,setAssets]=useState<EffectAsset[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [layer,setLayer]=useState(0);
  const [preview,setPreview]=useState<{html:string;receipt:string;revision:number;id:string}|null>(null);
  const [previewReady,setPreviewReady]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const refresh=()=>studioAssets.list("effect").then(r=>setAssets(r.assets.filter((a):a is EffectAsset=>a.kind==="effect"&&a.status!=="archived")));
  useEffect(()=>{let alive=true;studioAssets.list("effect").then(r=>{if(alive)setAssets(r.assets.filter((a):a is EffectAsset=>a.kind==="effect"&&a.status!=="archived"));}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
  useEffect(()=>{if(editor&&!dialog.current?.open)dialog.current?.showModal();},[editor]);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError(null);try{await fn();}catch(e){setError(e instanceof Error?e.message:"Action impossible.");}finally{setBusy(false);}};
  const open=(next:Editor)=>{setEditor(next);setLayer(0);setPreview(null);setPreviewReady(false);setError(null);};
  const change=(next:Editor)=>{setEditor(next);setPreview(null);setPreviewReady(false);};
  const fromMontage=(all:boolean)=>{try{open({asset:null,title:all?"Mon effet composé":"Mon animation",data:captureStudioEffect(all?custom:selected?[selected]:[],ranges),apply:false});}catch(e){setError((e as Error).message);}};
  const close=()=>{if(!busy){dialog.current?.close();setEditor(null);setPreview(null);}};
  const dirty=editor?(!editor.asset||JSON.stringify(editor.data)!==JSON.stringify(editor.asset.data)||editor.title!==editor.asset.title):false;

  return <section aria-label="Mes effets personnels" className="mb-4 space-y-3 border-b border-line pb-4">
    <h4 className="font-semibold">Mes effets</h4>
    <p className="text-xs text-mut">Créez, testez puis validez un effet pour le réutiliser dans vos clips.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost min-h-[44px] text-xs" disabled={disabled} onClick={()=>open({asset:null,title:"Nouvel effet",data:blank(),apply:false})}>Créer un effet</button>
      <button type="button" className="btn-ghost min-h-[44px] text-xs" disabled={disabled||!selected} onClick={()=>fromMontage(false)}>Enregistrer la carte comme effet</button>
      <button type="button" className="btn-ghost min-h-[44px] text-xs" disabled={disabled||!custom.length} onClick={()=>fromMontage(true)}>Enregistrer la composition</button>
    </div>
    {loading?<p role="status" className="text-xs">Chargement des effets…</p>:!assets.length?<p className="text-xs text-mut">Aucun effet personnel enregistré.</p>:<ul className="space-y-2">{assets.map(a=><li key={a.id} className="rounded-xl border border-line p-2">
      <p className="text-sm font-medium">{a.title}</p><p className="text-xs text-mut">Version {a.revision} · {a.status==="approved"?"Validé":"Brouillon"} · {a.data.layers.length} calque(s)</p>
      <div className="flex flex-wrap gap-1">
        {a.status==="approved"?<button type="button" className="btn-ghost min-h-[44px] px-2 text-xs" disabled={disabled||busy} onClick={()=>open({asset:a,title:a.title,data:structuredClone(a.data),apply:true})}>Adapter et placer</button>:null}
        <button type="button" className="btn-ghost min-h-[44px] px-2 text-xs" disabled={disabled||busy} onClick={()=>open({asset:a,title:a.title,data:structuredClone(a.data),apply:false})}>Modifier / tester</button>
        <button type="button" className="btn-ghost min-h-[44px] px-2 text-xs" disabled={disabled||busy} onClick={()=>void run(async()=>{await studioAssets.archive(a.id,a.revision);await refresh();})}>Archiver</button>
      </div>
    </li>)}</ul>}
    {error&&!editor?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
    {editor?<dialog ref={dialog} className="w-[min(960px,95vw)] max-h-[90dvh] overflow-auto rounded-2xl border border-line bg-white p-5 text-fg shadow-xl backdrop:bg-black/50" aria-label={editor.apply?"Adapter un effet":"Créer et valider un effet"} onCancel={e=>{e.preventDefault();close();}}>
      <header className="mb-4 flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{editor.apply?"Adapter pour ce clip":"Mon effet personnel"}</h3><button type="button" className="btn-ghost min-h-[44px]" disabled={busy} onClick={close}>Fermer</button></header>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm">Nom de l’effet<input className={input} maxLength={200} value={editor.title} disabled={busy||editor.apply} onChange={e=>change({...editor,title:e.target.value})}/></label>
          <p className="text-xs text-mut">{editor.apply?"Vérifiez les textes et médias avant de placer une copie au curseur. L’effet enregistré reste inchangé.":"Les versions déjà utilisées dans vos clips restent inchangées. Une modification doit être prévisualisée et validée à nouveau."}</p>
          <label className="block text-sm">Durée de l’effet (s)<input className={input} type="number" min="0.1" max="60" step="0.1" value={editor.data.durationMs/1000} disabled={busy} onChange={e=>{const n=e.target.valueAsNumber*1000;if(Number.isFinite(n)&&n>=Math.max(...editor.data.layers.map(a=>a.toMs))&&n<=60000)change({...editor,data:{...editor.data,durationMs:Math.round(n)}});}}/></label>
          <label className="block text-sm">Calque<select className={input} value={layer} disabled={busy} onChange={e=>setLayer(Number(e.target.value))}>{editor.data.layers.map((a,i)=><option key={a.id??i} value={i}>{i+1}. {ANIMATIONS[a.name]?.label??a.name}</option>)}</select></label>
          <StudioInspector key={`${editor.asset?.id??"new"}-${layer}`} animation={editor.data.layers[layer]??null} ranges={[{fromMs:0,toMs:editor.data.durationMs}]} disabled={busy}
            onChange={a=>change({...editor,data:{...editor.data,layers:editor.data.layers.map((c,i)=>i===layer?a:c)}})}
            onRemove={()=>{if(editor.data.layers.length<=1)return;change({...editor,data:{...editor.data,layers:editor.data.layers.filter((_,i)=>i!==layer)}});setLayer(0);}}
            onTest={()=>void run(async()=>{
              if(!editor.asset||dirty)throw new Error("Enregistrez cette version avant de la tester.");
              const p=await studioAssets.preview(editor.asset.id,editor.asset.revision);setPreviewReady(false);setPreview({html:p.html,receipt:p.previewRevision,revision:p.asset.revision,id:p.asset.id});
            })}/>
          {!editor.apply?<button type="button" className="btn-ghost min-h-[44px]" disabled={busy||editor.data.layers.length>=30} onClick={()=>change({...editor,data:{...editor.data,layers:[...editor.data.layers,{...blank().layers[0],toMs:Math.min(3000,editor.data.durationMs)}]}})}>Ajouter un titre</button>:null}
        </div>
        <div className="space-y-3">
          {preview?<div className="mx-auto max-w-[260px]"><ReelPreview html={preview.html} title={editor.title} onReady={()=>setPreviewReady(true)}/></div>:<p className="rounded-xl bg-black/5 p-5 text-sm">{editor.apply?"Après placement, testez cette copie dans le moniteur du montage avant le rendu.":"Enregistrez, puis testez cette version. La validation devient disponible après le chargement de l’aperçu."}</p>}
          {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
          <div className="flex flex-wrap gap-2">
            {editor.apply?<button type="button" className="btn-red min-h-[44px]" disabled={busy||disabled} onClick={()=>{try{onApply(parseStudioAssetData("effect",editor.data));close();}catch(e){setError((e as Error).message);}}}>Placer cette copie au curseur</button>:<>
              <button type="button" className="btn-red min-h-[44px]" disabled={busy||!dirty||!editor.title.trim()} onClick={()=>void run(async()=>{
                const r=await studioAssets.save({kind:"effect",title:editor.title,data:parseStudioAssetData("effect",editor.data),...(editor.asset?{assetId:editor.asset.id,expectedRevision:editor.asset.revision}:{})});
                change({asset:r.asset,title:r.asset.title,data:r.asset.data,apply:false});await refresh();
              })}>Enregistrer l’effet</button>
              <button type="button" className="btn-ghost min-h-[44px]" disabled={busy||dirty||!editor.asset} onClick={()=>void run(async()=>{
                const p=await studioAssets.preview(editor.asset!.id,editor.asset!.revision);setPreviewReady(false);setPreview({html:p.html,receipt:p.previewRevision,revision:p.asset.revision,id:p.asset.id});
              })}>Tester l’effet</button>
              <button type="button" className="btn-red min-h-[44px]" disabled={busy||dirty||!previewReady||!preview||editor.asset?.status==="approved"} onClick={()=>void run(async()=>{
                if(!preview||!editor.asset||preview.id!==editor.asset.id||preview.revision!==editor.asset.revision)throw new Error("Prévisualisez la version courante.");
                const r=await studioAssets.approve(preview.id,preview.revision,preview.receipt);change({asset:r.asset,title:r.asset.title,data:r.asset.data,apply:false});await refresh();
              })}>Valider pour la bibliothèque</button>
            </>}
          </div>
        </div>
      </div>
    </dialog>:null}
  </section>;
}
