import {afterEach, expect, it, vi} from "vitest";
import {diagnoseMetaAccess} from "@/server/instagram/diagnostic";
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it("réduit la réponse Meta à des métadonnées autorisées sans exposer de secret",async()=>{
  vi.stubEnv("IG_APP_ID","123");vi.stubEnv("IG_APP_SECRET","secret-value");
  const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
  const fetcher=vi.fn(async(input:URL|RequestInfo)=>new Response(JSON.stringify(String(input).includes("debug_token")?{data:{app_id:"123",is_valid:true,type:"SYSTEM_USER",access_token:"secret-token",scopes:["instagram_basic","secret-token"],granular_scopes:[{scope:"instagram_basic",target_ids:["1784","secret-token"]}]}}:{client_business_id:"456",access_token:"secret-token"})));
  const result=await diagnoseMetaAccess("secret-token",fetcher as typeof fetch);
  expect(result).toMatchObject({clientBusinessId:"456",tokenAppId:"123",valid:true,scopes:["instagram_basic"],targets:[{scope:"instagram_basic",ids:["1784"]}]});
  expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-token");
  expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-value");
});
