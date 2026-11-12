"use client";
import { useEffect, useRef, type ReactNode } from 'react';
export default function StudioLibraryDialog({open,onClose,children,title,closeLabel='Fermer la bibliothèque'}:{title:string;open:boolean;onClose:()=>void;children:ReactNode;closeLabel?:string}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close();},[open]);
 return <dialog ref={ref} aria-label={title} className="studio-library-dialog rounded-2xl border border-line bg-white p-4 text-fg shadow-2xl backdrop:bg-black/50" onCancel={onClose} onClose={onClose}>
  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-xl">{title}</h2><button type="button" className="btn-ghost min-h-[44px]" onClick={onClose} autoFocus>{closeLabel}</button></div>
  {children}
 </dialog>;
}
