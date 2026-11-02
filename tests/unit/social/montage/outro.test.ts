import { expect, it } from 'vitest';
import { initialEdit } from '@/domain/social/montage/montage';
import { buildEditComposition } from '@/domain/social/montage/edit-composition';
import { parseEdit } from '@/domain/social/montage/edit';
import { charteWarnings } from '@/domain/social/montage/charte';
it('ajoute exactement deux secondes après la dernière parole, en aperçu comme au rendu',()=>{
 const edit={...initialEdit('prise.mp4',10000),ranges:[{fromMs:0,toMs:4000},{fromMs:6000,toMs:10000}],outro:{durationMs:2000,baseline:true}};
 expect(parseEdit(edit).ok).toBe(true);
 for(const preview of [false,true]){
  const html=buildEditComposition(edit,[{text:'Fin',startMs:9500,endMs:9900}],{assetBase:'.',preview});
  expect(html).toContain('id="studio-outro"');
  expect(html).toContain('data-start="8" data-duration="2"');
  expect(html).toContain('data-duration="10"');
  expect(html).toContain('data-media-start="6"');
  expect(html).toContain('Fin');
 }
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repris tel quel de BeeMarketing
 expect(charteWarnings(edit as any)).not.toContain('Pas de logo BeeRecos de fin (conclusion du prompt maître : logo officiel et baseline).');
 expect(parseEdit({...edit,outro:{durationMs:50000,baseline:true}}).ok).toBe(false);
});
