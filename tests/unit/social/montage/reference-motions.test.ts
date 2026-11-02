import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { checkAnimation, renderAnimation } from "@/domain/social/montage/animations";
import { listMotions, searchMotions } from "@/domain/social/montage/beemotion";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
const ids = ["papier-dechire", "bandeau-double", "piliers-progressifs", "mot-impact"];
const ctx = { id: "ref1", start: 2, duration: 4, accent: "#2851FF" };
describe("reference video: editable motion cards", () => {
 it.each(ids)("%s is registered, safe and previewable but not auto-approved", id => {
  expect(ANIMATIONS[id]).toBeDefined();
  expect(checkAnimation(id, ANIMATIONS[id])).toEqual([]);
  expect(listMotions().find(m=>m.id===id)?.status).toBe("review");
  expect(searchMotions().some(m=>m.id===id)).toBe(false);
  const html=buildEditComposition({video:"p.mp4",ranges:[{fromMs:0,toMs:6000}],subtitles:false,custom:[{name:id,fromMs:1000,toMs:5000,props:ANIMATIONS[id].example}]},[],{assetBase:"."});
  expect(html).toContain(`class="anim-${id}`);
  expect(html).not.toContain('class="anim-erreur"');
 });
 it("allows clearing the optional replacement and keeps it hidden on the static poster",()=>{
  expect(renderAnimation("bandeau-double",{texte:"A",detail:"B",remplacement:""},ctx,ANIMATIONS).error).toBeUndefined();
  expect(ANIMATIONS["bandeau-double"].css).toContain(".replacement { opacity:0;");
 });
 it("escapes labels and bounds lists and tilt",()=>{
  const out=renderAnimation("papier-dechire",{items:["<script>x</script>","Deux"],angle:-4},ctx,ANIMATIONS);
  expect(out.error).toBeUndefined();expect(out.html).toContain("&lt;script&gt;");expect(out.html).not.toContain("<script>");
  expect(renderAnimation("papier-dechire",{items:["A"],angle:90},ctx,ANIMATIONS).error).toBeTruthy();
  expect(renderAnimation("piliers-progressifs",{items:["A"]},ctx,ANIMATIONS).error).toBeTruthy();
 });
 it("reveals separate papers sequentially and replaces the second band deterministically",()=>{
  const paper=renderAnimation("papier-dechire",{items:["Temps","Contacts","Énergie"]},ctx,ANIMATIONS);
  expect(paper.tweens.filter(t=>t.includes("fromTo"))).toHaveLength(3);
  const bands=renderAnimation("bandeau-double",{texte:"Chaque action",detail:"valeur",remplacement:"rémunérée",angle:0},ctx,ANIMATIONS);
  expect(bands.html).toContain("rémunérée");expect(bands.tweens.join(" ")).toContain("-r");
  expect(bands.tweens.join(" ")).not.toMatch(/onUpdate|Math.random|setTimeout/);
 });
});
