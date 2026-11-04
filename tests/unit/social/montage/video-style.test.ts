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
it('grand mot derrière le personnage : noir possible, entrée avec rebond, expression en deux temps, sous-titres devant',()=>{
 const edit={...initialEdit('prise.mp4',10000),mattes:{'prise.mp4':'prise.matte.webm'},custom:[{name:'titre-derriere',fromMs:1000,toMs:3000,props:{texte:'TON RÉSEAU DE CONFIANCE',couleur:'noir',entree:'rebond'}}]};
 expect(parseEdit(edit).ok).toBe(true);
 const html=buildEditComposition(edit,[{text:'Bonjour',startMs:0,endMs:2000}],{assetBase:'.'});
 expect(html).toContain('color: #000000; text-shadow: none');
 expect(html).toMatch(/scale: 0\.55, opacity: 0, duration: 0\.45, ease: "back\.out\(1\.6\)"[^;]*\}, 1\.05\)/);
 expect(html).toMatch(/back\.out\(1\.6\)[^;]*\}, 1\.35\)/);
 // Empilement : vidéo, grand mot (z 3), silhouette détourée (z 5), sous-titres (z 10).
 expect(html).toContain('.anim-host.behind { z-index: 3; }');expect(html).toContain('.matte-wrap { position: absolute; inset: 0; z-index: 5;');expect(html).toMatch(/\.caption \{ position: absolute; z-index: 10;/);
 // Montages déjà enregistrés (sans « entree ») : rendu inchangé, entrée floue.
 const old=buildEditComposition({...edit,custom:[{name:'titre-derriere',fromMs:1000,toMs:3000,props:{texte:'RÉSEAU'}}]},[],{assetBase:'.'});
 expect(old).not.toContain('back.out(1.6)');
});
