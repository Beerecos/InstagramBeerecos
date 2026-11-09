import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mockBee } from './bee-api';
import { initialEdit } from '../../src/domain/social/montage/montage';
import type { Edit } from '../../src/domain/social/montage/edit';

async function studio(page: Page, withMatte = false) {
  let version = 1;
  let edit: Edit = {...initialEdit('prise.mp4',6000), custom:[{id:'title', name:'titre',fromMs:0,toMs:5000,props:{texte:'TON RÉSEAU'}}]};
  if(withMatte) edit={...edit,mattes:{'prise.mp4':'prise.matte.webm'},custom:[{id:'closing',name:'logo-fin',fromMs:5000,toMs:6000,props:{baseline:true}}]};
  const saved: Edit[]=[];
  await mockBee(page, {
    get:()=>({montage:{id:'direct',title:'Studio BeeRecos',status:'ready',durationMs:6000,keptMs:6000,workspaceId:null,createdAt:'t',updatedAt:`v${version}`,renderStatus:null,sentToReels:false,finalVideoUrl:null,aiSource:null,edit,captions:[{text:'Ton réseau.',startMs:0,endMs:5000}],canUndo:false,canRedo:false,previewApproved:false,error:null,renderError:null,reel:null,brief:null,storyboard:null},videoUrl:'https://bee-api.test/fichiers/prise.mp4',matteUrls:withMatte?{'prise.matte.webm':'https://bee-api.test/fichiers/prise.matte.webm'}:{}}),
    'save-edit':body=>{edit=body.edit as Edit;saved.push(edit);version++;return {};},
  });
  const dir=mkdtempSync(join(tmpdir(),'studio-direct-'));
  const file=join(dir,'fixture.webm');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc=s=270x480:d=6:r=15','-c:v','libvpx-vp9','-b:v','100k','-an',file]);
  await page.route('https://bee-api.test/fichiers/**',r=>r.fulfill({body:readFileSync(file),contentType:'video/webm',headers:{'access-control-allow-origin':'*'}}));
  await page.goto('/reels/direct');
  await expect(page.getByRole('button',{name:'Déplacer la vidéo',exact:true})).toBeVisible();
  return saved;
}

const videoTransform=(page:Page)=>page.locator('hyperframes-player').evaluate(el=>{
  const doc=(el as HTMLElement & {iframeElement:HTMLIFrameElement}).iframeElement?.contentDocument;
  return doc?.getElementById('take-0')?.style.transform ?? '';
});
const animationTransform=(page:Page)=>page.locator('hyperframes-player').evaluate(el=>{
  const doc=(el as HTMLElement & {iframeElement:HTMLIFrameElement}).iframeElement?.contentDocument;
  return doc?.getElementById('placement-0')?.style.transform ?? '';
});

test('glisser la vidéo et le titre : aperçu pendant le geste, annulation et persistance après rechargement',async({page},info)=>{
  test.skip(info.project.name!=='desktop','glisser souris');
  const saved=await studio(page);
  await page.getByRole('button',{name:'Déplacer la vidéo',exact:true}).click();
  await page.getByLabel('Zoom vidéo').selectOption('1.5');
  await expect.poll(()=>saved.length).toBe(1);
  await expect.poll(()=>videoTransform(page)).toContain('scale(1.5)');
  const target=page.getByRole('button',{name:'Déplacer la vidéo dans le cadre',exact:true});
  const box=(await target.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2+10,{steps:6});
  await expect.poll(()=>videoTransform(page)).not.toContain('translate(0px, 0px)');
  expect(saved).toHaveLength(1); // le geste ne déclenche pas une rafale d'enregistrements
  await page.mouse.up();
  await expect.poll(()=>saved.length).toBe(2);
  expect(saved[1].framing?.x).toBeGreaterThan(0);
  const frame=saved[1].framing;
  await target.focus();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2-10,box.y+box.height/2,{steps:3});
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect.poll(()=>videoTransform(page)).toBe(`translate(${frame!.x}px, ${frame!.y}px) scale(1.5)`);
  expect(saved).toHaveLength(2);

  await page.getByTestId('timeline-animation').first().click();
  await page.getByRole('button',{name:'Déplacer une animation',exact:true}).click();
  const title=page.getByRole('button',{name:'Déplacer l’animation dans l’aperçu',exact:true});
  await expect(title).toBeVisible();
  const titleBox=(await title.boundingBox())!;
  await page.mouse.move(titleBox.x+titleBox.width/2,titleBox.y+titleBox.height/2);await page.mouse.down();
  await page.mouse.move(titleBox.x+titleBox.width/2+15,titleBox.y+titleBox.height/2+20,{steps:6});
  await expect.poll(()=>animationTransform(page)).not.toBe('translate(0px, 0px) scale(1)');
  expect(saved).toHaveLength(2);
  await page.mouse.up();
  await page.getByRole('button',{name:'Enregistrer le montage',exact:true}).click();
  await expect.poll(()=>saved.length).toBe(3);
  expect(saved[2].custom[0].placement?.x).toBeGreaterThan(0);
  expect(saved[2].framing).toEqual(frame);
  await page.reload();
  await expect(page.locator('hyperframes-player')).toHaveAttribute('srcdoc',new RegExp(`translate\\(${saved[2].custom[0].placement!.x}px,`));
  await page.getByTestId('timeline-animation').first().click();
  await page.getByRole('button',{name:'Déplacer une animation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Déplacer l’animation dans l’aperçu',exact:true})).toBeVisible();
  await page.screenshot({path:'/private/tmp/studio-direct-desktop.png',fullPage:true});
});

test("le texte derrière est accessible en mode simple et demande un vrai détourage",async({page})=>{
  const saved=await studio(page);
  await page.getByRole('button',{name:'Texte derrière le personnage',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Texte derrière le personnage',exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Pas de détourage',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Envoyer le détourage de la prise (.webm)')).toBeVisible();
  expect(saved).toHaveLength(0);
  await page.screenshot({path:`/private/tmp/studio-behind-${test.info().project.name}.png`,fullPage:true});
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});


test('une prise détourée permet de placer un titre BeeRecos derrière le personnage',async({page})=>{
  const saved=await studio(page,true);
  await page.getByRole('button',{name:'Texte derrière le personnage',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enregistrer le montage',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Enregistrer le montage',exact:true}).click();
  await expect.poll(()=>saved.length).toBe(1);
  const title=saved[0].custom.find(a=>a.name==='titre-derriere');
  expect(title?.props.texte).toBe('TON RÉSEAU');
  expect(saved[0].mattes).toEqual({'prise.mp4':'prise.matte.webm'});
  await expect(page.locator('hyperframes-player')).toHaveAttribute('srcdoc',/class="clip anim-host behind"/);
  await expect(page.locator('hyperframes-player')).toHaveAttribute('srcdoc',/id="matte-0"/);
});
