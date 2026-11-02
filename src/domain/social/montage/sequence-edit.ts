import type { Edit } from './edit';
import type { Scene } from './scenes';
import { cutSource } from './studio';

/** Coupe non destructive : fichiers et transcript source restent intacts. */
export function removeSequence(edit: Edit, scene: Pick<Scene, 'startMs' | 'endMs'>): Edit {
 const ranges=cutSource(edit.ranges,scene.startMs,scene.endMs);
 if(!ranges.length) throw new Error('Conservez au moins une séquence dans le montage.');
 const custom=edit.custom.flatMap(card=>{
  const kept=ranges.map(r=>({fromMs:Math.max(r.fromMs,card.fromMs),toMs:Math.min(r.toMs,card.toMs)})).filter(r=>r.toMs>r.fromMs);
  if(!kept.length) return [];
  return [{...card,fromMs:kept[0].fromMs,toMs:kept[kept.length-1].toMs}];
 });
 const sounds=edit.sounds.filter(sound=>ranges.some(r=>sound.atMs>=r.fromMs&&sound.atMs<r.toMs));
 return {...edit,ranges,custom,sounds};
}
