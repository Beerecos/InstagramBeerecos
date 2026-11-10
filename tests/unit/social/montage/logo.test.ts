import { expect, it } from "vitest";
import { initialEdit } from "@/domain/social/montage/montage";
import { parseEdit } from "@/domain/social/montage/edit";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
it("persists an optional bounded logo in both preview and final composition",()=>{
 const edit={...initialEdit("prise.mp4",10000),logo:{width:220,right:170,bottom:260,opacity:1}};
 for(const preview of [false,true]){
  const html=buildEditComposition(edit,[],{assetBase:".",preview});
  expect(html).toContain('id="studio-logo"');expect(html).toContain('right:170px;bottom:260px;width:220px;height:220px');expect(html).toContain('class="clip logo-cercle"');expect(html).toContain('border-radius: 50%; background: #ffffff');
  expect(html).toContain('src="./brand/beerecos-logo-transparent.png"');
 }
 expect(buildEditComposition({...edit,logo:undefined},[],{assetBase:"."})).not.toContain('id="studio-logo"');
 expect(parseEdit({...edit,logo:{...edit.logo,width:10000}}).ok).toBe(false);
});
