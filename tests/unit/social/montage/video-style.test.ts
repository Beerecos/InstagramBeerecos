import { expect, it } from 'vitest';
import { initialEdit } from '@/domain/social/montage/montage';
import { buildEditComposition } from '@/domain/social/montage/edit-composition';
import { parseEdit } from '@/domain/social/montage/edit';
it('applique le même cadrage à la vidéo et au détourage, sans déplacer les textes',()=>{
 const edit={...initialEdit('prise.mp4',10000),framing:{x:160,y:-30,scale:1.2},mattes:{'prise.mp4':'prise.matte.webm'},custom:[{name:'titre-derriere',fromMs:1000,toMs:3000,props:{texte:'RÉSEAU'}}]};
 const html=buildEditComposition(edit,[],{assetBase:'.'});
 expect(html.match(/transform: translate\(160px, -30px\) scale\(1.2\)/g)).toHaveLength(2);
 expect(html).toContain('class="clip anim-host behind"');
 expect(parseEdit({...edit,framing:{x:9999,y:0,scale:1}}).ok).toBe(false);
});
it('rend la police, la taille et les couleurs des sous-titres sans CSS arbitraire',()=>{
 const edit={...initialEdit('prise.mp4',10000),captionStyle:{fontFamily:'Caveat',fontSize:96,color:'#00FF00',highlightColor:'#2851FF',backgroundColor:'#000000'}};
 const html=buildEditComposition(edit,[{text:'Bonjour',startMs:0,endMs:2000}],{assetBase:'.'});
 expect(html).toContain('font-family: "Caveat"');expect(html).toContain('font-size: 96px');
 expect(html).toContain('color: #00FF00');expect(html).toContain('color: "#2851FF"');expect(html).toContain('background: #000000');
 expect(parseEdit({...edit,captionStyle:{color:'red;position:fixed'}}).ok).toBe(false);
 expect(parseEdit({...edit,captionStyle:{fontFamily:'url(evil)'}}).ok).toBe(false);
});
