"use client";
import { useState } from "react";
import { CAPTION_DEFAULTS } from "@/domain/social/montage/brand";
import type { CaptionWord, Edit } from "@/domain/social/montage/edit";

/**
 * SOUS-TITRES DU STUDIO : réglages du bloc (repères du document « Prompts réseaux sociaux » : centré, 760 px, y = 1460,
 * 44 px — réglables) et correction du texte d'un mot sélectionné dans le transcript (le minutage ne change pas).
 */

type Props = {
  edit: Edit;
  words: CaptionWord[];
  selectedWord: number | null;
  disabled?: boolean;
  onPreview?: (patch: Pick<Edit, "subtitles" | "captionStyle">) => void;
  onSave: (patch: Pick<Edit, "subtitles" | "captionStyle">) => Promise<void>;
  onFixWord: (i: number, text: string) => Promise<void>;
};

export default function StudioCaptions({ edit, words, selectedWord, disabled, onSave, onFixWord, onPreview }: Props) {
  const [top, setTop] = useState(edit.captionStyle.top ?? CAPTION_DEFAULTS.top);
  const [fontSize, setFontSize] = useState(edit.captionStyle.fontSize ?? CAPTION_DEFAULTS.fontSize);
  const [maxWidth, setMaxWidth] = useState(edit.captionStyle.maxWidth ?? CAPTION_DEFAULTS.maxWidth);
  const [fontFamily,setFontFamily]=useState<"Poppins"|"Caveat">(edit.captionStyle.fontFamily??"Poppins");
  const [color,setColor]=useState(edit.captionStyle.color??"#CCCCCC");
  const [highlightColor,setHighlightColor]=useState(edit.captionStyle.highlightColor??"#FFFFFF");
  const [backgroundColor,setBackgroundColor]=useState(edit.captionStyle.backgroundColor??"#000000");
  const [fix, setFix] = useState<{ i: number; text: string } | null>(null);
  const word = selectedWord !== null ? words[selectedWord] : null;
  const current = fix && fix.i === selectedWord ? fix.text : word?.text.trim() ?? "";
  const style = (t: number, f: number, w: number) => ({
    fontFamily,color,highlightColor,backgroundColor,
    ...(t !== CAPTION_DEFAULTS.top ? { top: t } : {}), ...(f !== CAPTION_DEFAULTS.fontSize ? { fontSize: f } : {}), ...(w !== CAPTION_DEFAULTS.maxWidth ? { maxWidth: w } : {}),
  });
  const slider = (label: string, value: number, set: (n: number) => void, min: number, max: number, unit: string) => (
    <label className="block text-sm">
      <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-mut">{value} {unit}</span></span>
      <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => set(Number(e.target.value))} className="w-full" />
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={edit.subtitles} disabled={disabled} onChange={(e) => void onSave({ subtitles: e.target.checked, captionStyle: edit.captionStyle })} />
        Afficher les sous-titres (karaoké, toujours au premier plan)
      </label>
      <div className="space-y-3">
        <label className="block text-sm">Police des sous-titres<select className="ml-2 min-h-[44px] rounded border border-line px-2" value={fontFamily} disabled={disabled} onChange={e=>setFontFamily(e.target.value as "Poppins"|"Caveat")}><option value="Poppins">Poppins</option><option value="Caveat">Caveat manuscrite</option></select></label>
        {([["Couleur du texte",color,setColor],["Couleur du mot prononcé",highlightColor,setHighlightColor],["Fond des sous-titres",backgroundColor,setBackgroundColor]] as const).map(([label,value,set])=><label key={label} className="flex min-h-[44px] items-center justify-between gap-2 text-sm">{label}<input type="color" value={value} disabled={disabled} onChange={e=>set(e.target.value)} /></label>)}
        {slider("Haut du bloc", top, setTop, 900, 1700, "px")}
        {slider("Taille des sous-titres", fontSize, setFontSize, 32, 120, "px")}
        {slider("Largeur maximale", maxWidth, setMaxWidth, 400, 1000, "px")}
        <div className="flex flex-wrap gap-2">
          {onPreview?<button type="button" className="btn-ghost min-h-[44px]" disabled={disabled} onClick={()=>onPreview({subtitles:edit.subtitles,captionStyle:style(top,fontSize,maxWidth)})}>Prévisualiser le style</button>:null}
          <button type="button" className="btn-red min-h-[40px] px-3 text-sm" disabled={disabled} onClick={() => void onSave({ subtitles: edit.subtitles, captionStyle: style(top, fontSize, maxWidth) })}>Appliquer</button>
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={disabled} onClick={() => { setFontFamily("Poppins");setColor("#CCCCCC");setHighlightColor("#FFFFFF");setBackgroundColor("#000000");setTop(CAPTION_DEFAULTS.top); setFontSize(CAPTION_DEFAULTS.fontSize); setMaxWidth(CAPTION_DEFAULTS.maxWidth); void onSave({ subtitles: edit.subtitles, captionStyle: {} }); }}>Repères BeeRecos</button>
        </div>
        <p className="text-xs text-mut">Repères : bloc centré (x = 540), {CAPTION_DEFAULTS.maxWidth} px de large, haut à y = {CAPTION_DEFAULTS.top}, {CAPTION_DEFAULTS.fontSize} px, Poppins Medium, deux lignes au plus. Vérifiez dans l&apos;aperçu.</p>
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        <h4 className="text-sm font-semibold">Corriger un mot</h4>
        {word ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (selectedWord !== null && current.trim()) void onFixWord(selectedWord, current).then(() => setFix(null)); }}>
            <input aria-label="Texte du mot" value={current} maxLength={40} disabled={disabled} onChange={(e) => selectedWord !== null && setFix({ i: selectedWord, text: e.target.value })} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
            <button type="submit" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={disabled || !current.trim() || current.trim() === word.text.trim()}>Corriger</button>
          </form>
        ) : <p className="text-xs text-mut">Sélectionnez un mot dans le transcript pour corriger son orthographe (le sous-titre reprend la parole sans la reformuler).</p>}
      </div>
    </div>
  );
}
