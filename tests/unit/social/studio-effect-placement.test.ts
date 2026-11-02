import { describe, expect, it } from "vitest";
import { captureStudioEffect, placeStudioEffect } from "@/domain/social/studio-effect-placement";
import { checkTimeline } from "@/domain/social/montage/suggest";
import { checkStudioEdit } from "@/domain/social/montage/studio";
import { initialEdit } from "@/domain/social/montage/montage";
import { animationOutputRange } from "@/domain/social/montage/placement";
const ranges = [{fromMs:0,toMs:2000},{fromMs:5000,toMs:10000}];
const layer = {name:"titre",fromMs:1000,toMs:6000,props:{texte:"Texte source"}};
describe("reusable effect placement over cuts",()=>{
 it("captures visible timing and makes a detached snapshot",()=>{
  const effect=captureStudioEffect([layer],ranges);
  expect(effect).toMatchObject({durationMs:2000,layers:[{fromMs:0,toMs:2000}]});
  effect.layers[0].props.texte="Nouveau"; expect(layer.props.texte).toBe("Texte source");
 });
 it("places relative layers in output time without restoring the cut",()=>{
  const placed=placeStudioEffect(captureStudioEffect([layer],ranges),ranges,1500,()=>"new");
  expect(placed[0]).toMatchObject({id:"new",fromMs:1500,toMs:6500});
  expect(animationOutputRange(placed[0],ranges)).toEqual({fromMs:1500,toMs:3500});
 });
 it("saves simultaneous layers as an independent composition, retaining collision checks",()=>{
  const effect={schemaVersion:1 as const,durationMs:1500,layers:[{...layer,fromMs:0,toMs:1500,placement:{x:0,y:-200,scale:1,opacity:1,enter:"native" as const,exit:"none" as const}},{...layer,fromMs:0,toMs:1500,placement:{x:0,y:200,scale:1,opacity:1,enter:"native" as const,exit:"none" as const}}]};
  let n=0; const custom=placeStudioEffect(effect,ranges,0,()=>`id${++n}`);
  expect(custom[0].groupId).toBe(custom[1].groupId);
  expect(custom[0].id).not.toBe(custom[1].id);
  const base=initialEdit("prise.mp4",10000);
  expect(checkStudioEdit({...base,custom},base,10000).ok).toBe(true);
  expect(checkTimeline([...custom,{...layer,fromMs:500,toMs:2000}])).not.toEqual([]);
 });
 it("refuses an effect that cannot fit or invisible layers",()=>{
  expect(()=>placeStudioEffect(captureStudioEffect([layer],ranges),ranges,6500)).toThrow();
  expect(()=>captureStudioEffect([{...layer,fromMs:2100,toMs:4000}],ranges)).toThrow();
 });
});
