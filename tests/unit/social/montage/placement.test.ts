import { describe, expect, it } from 'vitest';
import { CustomAnimationSchema, type Edit } from '@/domain/social/montage/edit';
import { animationOutputRange, retimeAnimation, withAnimationIds } from '@/domain/social/montage/placement';
import { buildEditComposition } from '@/domain/social/montage/edit-composition';
const a = {name:'titre',fromMs:1000,toMs:2500,props:{texte:'Bonjour'}};
const ranges = [{fromMs:0,toMs:2000},{fromMs:5000,toMs:8000}];
describe('placements de cartes du studio', () => {
  it('conserve les anciens clips et valide les placements bornés', () => {
    expect(CustomAnimationSchema.safeParse(a).success).toBe(true);
    expect(CustomAnimationSchema.safeParse({...a,id:'a-1',placement:{x:20,y:-30,scale:1.2,opacity:.9,enter:'fade',exit:'fade'}}).success).toBe(true);
    for (const placement of [{x:Infinity},{scale:0},{opacity:2},{x:1081},{y:1921},{css:'display:none'}]) expect(CustomAnimationSchema.safeParse({...a,placement}).success).toBe(false);
  });
  it('conserve les identités après tri et différencie deux cartes identiques', () => {
    const first = withAnimationIds([a,a]);
    expect(first[0].id).not.toBe(first[1].id);
    expect(withAnimationIds([...first].reverse()).map(x=>x.id)).toEqual(first.map(x=>x.id).reverse());
    expect(withAnimationIds([a,a])).toEqual(first);
  });
  it('déplace en temps monté au travers de la coupe sans remettre celle-ci', () => {
    const moved=retimeAnimation(a,ranges,1500,3000);
    expect(moved).toMatchObject({fromMs:1500,toMs:6000});
    expect(animationOutputRange(moved,ranges)).toEqual({fromMs:1500,toMs:3000});
    expect(retimeAnimation(a,ranges,500,2000)).toMatchObject({fromMs:500,toMs:2000});
    expect(retimeAnimation(a,ranges,2000,5000)).toMatchObject({fromMs:5000,toMs:8000});
    expect(ranges).toEqual([{fromMs:0,toMs:2000},{fromMs:5000,toMs:8000}]);
  });
  it('refuse une fenêtre hors montage, vide ou non numérique', () => {
    for (const [from,to] of [[-1,1000],[0,5001],[2000,2050],[NaN,1000],[2000,1000]]) expect(()=>retimeAnimation(a,ranges,from,to)).toThrow();
  });
  it('place dans un wrapper séparé du mouvement natif, conserve le même rendu export/aperçu', () => {
    const edit:Edit={video:'prise.mp4',accent:'bleu',ranges:[{fromMs:0,toMs:5000}],subtitles:false,captionStyle:{},voiceGain:1,sounds:[],custom:[{...a,placement:{x:20,y:-30,scale:1.2,opacity:.9,enter:'fade',exit:'fade'}}]};
    for(const preview of [true,false]) {
      const html=buildEditComposition(edit,[],{assetBase:'.',preview});
      expect(html).toContain('translate(20px,-30px) scale(1.2)');
      expect(html).toContain('id="placement-0"');
      expect(html).toContain('id="motion-0"');
    }
    expect(CustomAnimationSchema.safeParse({...a,name:'logo-fin',placement:{enter:'slide'}}).success).toBe(false);
  });
});
