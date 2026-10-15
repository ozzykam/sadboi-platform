
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
const fromWeb=createRequire(path.resolve("web-app/package.json"));
const sharp=fromWeb("sharp");
export async function artworkChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}) {
 assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST,"127.0.0.1:9199");
 const input={title:"Shared original",series:"Tests",year:2026,medium:"Digital painting",description:"An emulator-only artwork.",status:"draft",rights:"owned",tags:["test"],pixelWidth:2,pixelHeight:2,colorProfile:"sRGB",internalNotes:"Private studio notes"};
 const operationId=randomUUID();
 async function mutate(url, method, body, cookie=ownerCookie){
  const proof=await csrf();
  return request(url,{method,headers:{"Content-Type":"application/json",Origin:origin,Cookie:cookie+"; "+proof.cookie,"X-CSRF-Token":proof.token},body:JSON.stringify(body)});
 }
 async function read(url,cookie=ownerCookie){return request(url,{headers:{Cookie:cookie}});}
 assert.equal((await request("/api/artworks")).status,401);check("anonymous cannot list artwork");
 const created=await mutate("/api/artworks","POST",{input,operationId});
 assert.equal(created.status,201,await created.clone().text());
 let art=(await created.json()).artwork;
 assert.equal(art.internalNotes,input.internalNotes);assert.equal(art.revision,1);check("artwork saved to shared Firestore");
 const url="/api/artworks/"+art.id;
 const repeated=await mutate("/api/artworks","POST",{input,operationId});
 assert.equal((await repeated.json()).artwork.id,art.id);
 assert.equal((await db.collection("businesses/sadboi/artworks").get()).size,1);check("create retry does not duplicate artwork");
 assert.equal((await mutate("/api/artworks","POST",{input:{...input,title:"Different"},operationId})).status,409);check("idempotency key cannot create different artwork");
 const secondAdmin=await identity("second-admin@example.test",true,"super_admin");
 const secondCookie=session(await signIn(secondAdmin));
 const shared=await read(url,secondCookie);assert.equal(shared.status,200);assert.equal((await shared.json()).artwork.title,input.title);check("second super admin sees the same artwork");
 const legal=await read(url,legalCookie);assert.equal(legal.status,200);assert.equal("internalNotes" in (await legal.json()).artwork,false);check("legal record projection excludes internal notes");
 const listing=await read("/api/artworks",legalCookie);assert.equal("internalNotes" in (await listing.json()).artworks[0],false);check("legal catalog excludes internal notes");
 assert.equal((await mutate(url,"PATCH",{input,revision:1,operationId:randomUUID()},legalCookie)).status,403);check("legal cannot modify artwork");
 const accountant=await identity("art-accountant@example.test",true,"accounting");
 const accountantCookie=session(await signIn(accountant));
 assert.equal((await read(url,accountantCookie)).status,403);check("accounting cannot read artwork directly");
 assert.equal((await mutate("/api/artworks","POST",{input:{...input,businessId:"other"},operationId:randomUUID()})).status,400);
 assert.equal((await mutate("/api/artworks","POST",{input,operationId:randomUUID(),businessId:"other"})).status,400);check("client cannot inject ownership fields");
 const firstOperation=randomUUID();
 const results=await Promise.all([
  mutate(url,"PATCH",{input:{...input,title:"First editor"},revision:1,operationId:firstOperation}),
  mutate(url,"PATCH",{input:{...input,title:"Second editor"},revision:1,operationId:randomUUID()},secondCookie),
 ]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);check("concurrent edits cannot silently overwrite");
 art=(await (await read(url)).json()).artwork;
 assert.equal(art.revision,2);
 const archiveOp=randomUUID(),archived={...input,title:art.title,status:"archived"};
 assert.equal((await mutate(url,"PATCH",{input:archived,revision:2,operationId:archiveOp})).status,200);
 const archiveRetry=await mutate(url,"PATCH",{input:archived,revision:2,operationId:archiveOp});
 assert.equal((await archiveRetry.json()).artwork.revision,3);check("archive and update retry preserve a single metadata revision");
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:"#8b303a"}}).png().toBuffer();
 async function upload(body,type="image/png",cookie=ownerCookie,key=randomUUID(),csrfEnabled=true){
  const proof=await csrf();
  return request(url+"/assets",{method:"POST",headers:{"Content-Type":type,Origin:origin,Cookie:cookie+"; "+proof.cookie,...(csrfEnabled?{"X-CSRF-Token":proof.token}:{}),"X-File-Name":"test-art.png","X-Upload-ID":key},body});
 }
 assert.equal((await upload(bytes,"image/png",legalCookie)).status,403);check("legal cannot upload originals");
 assert.equal((await upload(bytes,"image/png",ownerCookie,randomUUID(),false)).status,403);check("image upload requires CSRF proof");
 assert.equal((await upload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).status,400);
 assert.equal((await upload(Buffer.from("not an image"))).status,400);
 assert.equal((await upload(bytes,"image/jpeg")).status,400);check("spoofed, unsupported, and mismatched image types are rejected");
 assert.equal((await upload(Buffer.alloc(30*1024*1024+1))).status,413);check("oversized image rejected before decoding");
 const uploadId=randomUUID();
 const uploaded=await upload(bytes,"image/png",ownerCookie,uploadId);
 assert.equal(uploaded.status,201,await uploaded.clone().text());
 const asset=(await uploaded.json()).asset;
 assert.equal(asset.sha256,createHash("sha256").update(bytes).digest("hex"));assert.equal(asset.width,2);
 assert.equal("originalPath" in asset,false);check("valid image produces private asset metadata without object paths");
 const retried=await upload(bytes,"image/png",ownerCookie,uploadId);assert.equal((await retried.json()).asset.id,asset.id);
 assert.equal((await db.doc("businesses/sadboi/artworks/"+art.id).get()).data().assetCount,1);check("upload retry does not duplicate files or image count");
 const image=url+"/assets/"+asset.id;
 assert.equal((await request(image)).status,401);check("anonymous cannot read private preview");
 assert.equal((await read(image,accountantCookie)).status,403);check("accounting cannot read private preview");
 const preview=await read(image,legalCookie);assert.equal(preview.status,200);assert.equal(preview.headers.get("content-type"),"image/webp");assert.match(preview.headers.get("cache-control"),/no-store/);check("legal can view an authorized private preview");
 assert.equal((await read(image+"?download=1",legalCookie)).status,403);check("legal cannot download original");
 const original=await read(image+"?download=1",secondCookie);
 assert.equal(original.status,200);assert.match(original.headers.get("content-disposition"),/attachment/);
 assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes);check("super admin downloads the unchanged original");
 const ready=(await (await read(url)).json()).artwork;assert.equal(ready.coverAssetId,asset.id);assert.equal(ready.revision,3);check("image updates preserve metadata revision and update catalog cover");
 const wrongArtwork="/api/artworks/"+"0".repeat(64)+"/assets/"+asset.id;
 assert.equal((await read(wrongArtwork)).status,404);check("asset cannot be fetched through a different artwork");
 assert.equal((await read(url+"/assets/"+"0".repeat(64))).status,404);check("unknown asset is private and returns not found");
 await db.doc("businesses/sadboi/memberships/"+secondAdmin.uid).update({status:"revoked"});
 assert.equal((await read(image,secondCookie)).status,401);check("revoked staff immediately lose image access");
 const editor=await read("/admin/artworks/"+art.id);assert.equal(editor.status,200);assert.match(await editor.text(),/Save artwork/);check("shared editor page renders saved artwork");
 const legalPage=await read("/admin/artworks/"+art.id,legalCookie);assert.equal(legalPage.status,200);const legalHtml=await legalPage.text();assert.equal(legalHtml.includes("Private studio notes"),false);check("legal rendered page does not serialize internal notes");
 const listPage=await read("/admin/artworks");assert.equal(listPage.status,200);assert.match(await listPage.text(),/PRIVATE STUDIO CATALOG/);check("shared catalog page renders");
 const storedAsset=await db.doc("businesses/sadboi/artworks/"+art.id+"/assets/"+asset.id).get();
 const attempts=await storedAsset.ref.collection("attempts").get();assert.equal(attempts.size,1);assert.equal(attempts.docs[0].data().status,"ready");check("upload attempt journal records completed object paths");
 const eventCount=(await db.doc("businesses/sadboi/artworks/"+art.id).collection("events").get()).size;
 assert.equal(eventCount,4);check("create, edit, archive, and upload have audit events without retry duplicates");
 const imageResponse=await read(url+"/assets");assert.equal((await imageResponse.json()).assets.length,1);check("image list contains only completed uploads");
 const template=(await db.doc("businesses/sadboi/artworks/"+art.id).get()).data();
 const batch=db.batch();
 for(let i=0;i<51;i++)batch.create(db.doc("businesses/sadboi/artworks/"+createHash("sha256").update("page-"+i).digest("hex")),{...template,coverAssetId:null,input:{...input,title:"Page fixture "+i}});
 await batch.commit();
 const page1=await (await read("/api/artworks")).json();assert.equal(page1.artworks.length,50);assert.ok(page1.nextCursor);
 const page2=await (await read("/api/artworks?cursor="+page1.nextCursor)).json();assert.equal(page2.artworks.length,2);assert.equal(page2.nextCursor,null);
 assert.equal(new Set([...page1.artworks,...page2.artworks].map(a=>a.id)).size,52);check("catalog pagination has no duplicate or missing records");
 assert.equal((await read("/api/artworks?cursor=invalid/path")).status,404);check("invalid cursor cannot escape the business collection");
 const {artworkRemovalChecks}=await import("./artwork-removal-integration.mjs");
 await artworkRemovalChecks({request,csrf,ownerCookie,legalCookie,db,check,origin});
}
