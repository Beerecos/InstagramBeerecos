import { describe, expect, it } from 'vitest';
import { CENTERED_FRAME, dragFraming } from '@/domain/social/montage/direct-framing';
import { initialEdit } from '@/domain/social/montage/montage';
import { buildEditComposition } from '@/domain/social/montage/edit-composition';

describe('cadrage direct sans bord vide', () => {
  it('déplace le recadrage paysage avant de translater la prise', () => {
    const next = dragFraming(CENTERED_FRAME, 200, 0, 16/9);
    expect(next.focusX).toBeLessThan(50);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });
  it('limite la translation aux marges du zoom pour une prise verticale', () => {
    expect(dragFraming(CENTERED_FRAME, 100, 100, 9/16)).toEqual(CENTERED_FRAME);
    expect(dragFraming({...CENTERED_FRAME,scale:1.5},10000,-10000,9/16)).toMatchObject({x:270,y:-480,scale:1.5});
    expect(dragFraming({...CENTERED_FRAME,scale:1.5},100,-100,NaN)).toMatchObject({x:100,y:-100});
  });
  it('conserve le cadrage identique sur la silhouette, les prises et les zooms de coupe', () => {
    const edit = {...initialEdit('prise.mp4',6000), ranges:[{fromMs:0,toMs:3000},{fromMs:3000,toMs:6000}], framing:{...CENTERED_FRAME,x:100,scale:1.5}, rythme:{zoomCoupes:true,zoom:1.1}, mattes:{'prise.mp4':'prise.matte.webm'},custom:[{name:'titre-derriere',fromMs:3500,toMs:5500,props:{texte:'RÉSEAU'}}]};
    for(const preview of [true,false]) {
      const html=buildEditComposition(edit,[],{assetBase:'.',preview});
      for(const id of ['take-1','matte-1']) expect(html).toMatch(new RegExp(`id="${id}"[^>]*data-rhythm-zoom="1.1"[^>]*translate\\(100px, 0px\\) scale\\(1.6500000000000001\\)`));
      expect(html).toContain('id="placement-0"'); // ancien montage sans placement manuel
      expect(html).toContain('class="clip anim-host behind"');
      expect(html).toContain('.matte-wrap');
    }
  });
});
