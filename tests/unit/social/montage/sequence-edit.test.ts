import { describe, expect, it } from 'vitest';
import { initialEdit } from '@/domain/social/montage/montage';
import { removeSequence } from '@/domain/social/montage/sequence-edit';
import { checkStudioEdit } from '@/domain/social/montage/studio';

describe('supprimer une séquence sans toucher aux médias source', () => {
 const original={...initialEdit('prise.mp4',10000),custom:[
  {name:'titre',fromMs:1000,toMs:2500,props:{texte:'Avant'}},
  {name:'titre',fromMs:7000,toMs:9000,props:{texte:'Après'}},
 ],sounds:[{file:'son.mp3',atMs:7000,volume:1}],outro:{durationMs:2000 as const,baseline:true}};
 it('retire la dernière séquence et ses cartes/sons, conserve la prise et la clôture',()=>{
  const edit=removeSequence(original,{startMs:6000,endMs:10000});
  expect(edit.ranges).toEqual([{fromMs:0,toMs:6000}]);
  expect(edit.custom.map(a=>a.props.texte)).toEqual(['Avant']);
  expect(edit.sounds).toEqual([]);
  expect(edit.video).toBe('prise.mp4');expect(edit.outro).toEqual(original.outro);
  expect(original.custom).toHaveLength(2);expect(original.ranges).toEqual([{fromMs:0,toMs:10000}]);
  expect(checkStudioEdit(edit,original,10000).ok).toBe(true);
 });
 it('conserve les coupes précédentes et raccourcit une carte à cheval sur la coupe',()=>{
  const edit=removeSequence({...initialEdit('prise.mp4',10000),ranges:[{fromMs:0,toMs:2000},{fromMs:3000,toMs:10000}],custom:[{name:'titre',fromMs:1000,toMs:5000,props:{texte:'Titre'}}]}, {startMs:4000,endMs:7000});
  expect(edit.ranges).toEqual([{fromMs:0,toMs:2000},{fromMs:3000,toMs:4000},{fromMs:7000,toMs:10000}]);
  expect(edit.custom[0]).toMatchObject({fromMs:1000,toMs:4000});
 });
 it('refuse de supprimer tout le montage',()=>{
  expect(()=>removeSequence(original,{startMs:0,endMs:10000})).toThrow('au moins une séquence');
 });
});
