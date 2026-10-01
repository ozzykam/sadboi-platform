
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const root = process.cwd();
const fromWeb = createRequire(path.join(root, "web-app/package.json"));
const { initializeApp } = fromWeb("firebase-admin/app");
const { getAuth } = fromWeb("firebase-admin/auth");
const { getFirestore } = fromWeb("firebase-admin/firestore");
assert.equal(process.env.GCLOUD_PROJECT, "demo-sadboi-platform");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
const app = initializeApp({projectId: "demo-sadboi-platform"});
const auth = getAuth(app); const db = getFirestore(app);
// Browser previews use a separate hostname so their cookies cannot replace a
// live developer session on 127.0.0.1:3100 (cookies are not scoped to ports).
const browserPreview = process.argv.includes("--after-sales-preview") || process.argv.includes("--shipping-preview") || process.argv.includes("--gallery-preview") || process.argv.includes("--fulfillment-preview") || process.argv.includes("--payment-preview") || process.argv.includes("--lifecycle-preview") || process.argv.includes("--email-preview");
const paymentSecret = "emulator-only-" + randomUUID();
const expirySecret = "emulator-only-expiry-" + randomUUID();
const stripe = (process.argv.includes("--after-sales") || process.argv.includes("--order-lifecycle") || process.argv.includes("--shipping")) ? await (await import("./stripe-fixture.mjs")).stripeFixture() : null;
const email = process.argv.includes("--order-emails") ? await (await import("./email-fixture.mjs")).emailFixture() : null;
const origin = browserPreview ? "http://localhost:3102" : "http://127.0.0.1:3102";
const aliasOrigin = browserPreview ? "http://127.0.0.1:3102" : "http://localhost:3102";
const server = spawn(process.execPath, [fromWeb.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
 cwd: path.join(root, "web-app"),
 env: {...process.env, SADBOI_MODE:"staff", SADBOI_AUTH_ENV:"emulator", SADBOI_APP_ORIGIN:origin, SADBOI_AUTH_TEST:"1", NEXT_TELEMETRY_DISABLED:"1", SADBOI_PAYMENT_WEBHOOK_SECRET:paymentSecret, SADBOI_EXPIRY_SECRET:expirySecret, SADBOI_STRIPE_ENABLED:"0", SADBOI_ORDER_EMAIL_MODE:"disabled", ...(stripe?.env ?? {}), ...(email?.env ?? {})},
 stdio:["ignore","pipe","pipe"], windowsHide:true,
});
let log = ""; server.stdout.on("data", x=>{log=(log+x).slice(-12000)}); server.stderr.on("data", x=>{log=(log+x).slice(-12000)});
// Long fixture setup/imports can outlive Next dev's idle keep-alive sockets on
// Windows. Use fresh local test connections rather than retrying mutations or
// weakening assertions when the next suite starts.
const request = (url, init={}) => fetch(origin+url, {...init, headers:{...init.headers, Connection:"close"}, redirect:"manual", signal:AbortSignal.timeout(60000)});
const { withCheckoutQuotes } = await import("./checkout-quote-helper.mjs");
const checkoutRequest = withCheckoutQuotes(request);
let passed = 0;
const check = (name) => { passed++; console.log("PASS "+name); };
const uid = label => label+"-"+Date.now();
async function identity(email, verified=true, role) {
 const user = await auth.createUser({uid:uid(email.split("@")[0]),email,password:"Emulator-password-123!",emailVerified:verified});
 if (role) await db.doc("businesses/sadboi/staffInvites/"+createHash("sha256").update(email).digest("hex")).set({email,role,status:"pending"});
 const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:"Emulator-password-123!",returnSecureToken:true})});
 assert.equal(response.status,200);
 return {...user,token:(await response.json()).idToken};
}
async function csrf() {
 const response = await request("/api/auth/csrf");
 assert.equal(response.status,200);
 return {token:(await response.json()).token,cookie:response.headers.get("set-cookie").split(";")[0]};
}
async function signIn(user, extras={}) {
 // Match a real sign-in: get a fresh auth_time, including after a long browser
 // preview. Reusing the original token tests recent-login expiry, not access.
 const login = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", {
  method:"POST", headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email:user.email,password:"Emulator-password-123!",returnSecureToken:true}),
 });
 assert.equal(login.status,200);
 const { idToken } = await login.json();
 const proof = await csrf();
 return request("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,Cookie:proof.cookie,"X-CSRF-Token":proof.token},body:JSON.stringify({idToken,...extras})});
}
const session = response => response.headers.getSetCookie().find(c=>c.startsWith("sadboi_session=")).split(";")[0];
async function status(cookie) { return request("/api/auth/session",{headers:{Cookie:cookie}}); }
function redirected(response, target) {
 const location=response.headers.get("location");
 assert.ok(location?.includes(target), "Expected redirect to "+target+", got "+response.status+" "+location);
}
try {
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null) throw new Error("Test server stopped");
  try { const r=await request("/api/auth/session"); if(r.status===401){ready=true;break} } catch {}
  await delay(500);
 }
 assert.ok(ready,"Test server should start");
 check("anonymous API access denied");
 redirected(await request("/admin"),"/sign-in"); check("anonymous dashboard redirected");
 const login = await request("/sign-in"); assert.equal(login.status,200); assert.match(await login.text(),/First visit/); check("sign-in page renders");
 const alias = await fetch(aliasOrigin+"/sign-in", {redirect:"manual",signal:AbortSignal.timeout(30000)});
 assert.equal(alias.status,307);
 assert.equal(alias.headers.get("location"),origin+"/sign-in"); check("loopback alias redirects to canonical sign-in before authentication");
 const proof=await csrf();
 const base={"Content-Type":"application/json",Origin:origin,Cookie:proof.cookie,"X-CSRF-Token":proof.token};
 assert.equal((await request("/api/auth/session",{method:"POST",headers:{...base,Origin:"https://attacker.example"},body:"{}"})).status,403); check("foreign origin rejected");
 assert.equal((await request("/api/auth/session",{method:"POST",headers:{...base,Origin:aliasOrigin},body:"{}"})).status,403); check("session still requires exact canonical origin");
 const noOrigin={...base}; delete noOrigin.Origin;
 assert.equal((await request("/api/auth/session",{method:"POST",headers:noOrigin,body:"{}"})).status,403); check("missing origin rejected");
 assert.equal((await request("/api/auth/session",{method:"POST",headers:{...base,"X-CSRF-Token":"a".repeat(64)},body:"{}"})).status,403); check("invalid CSRF rejected");
 assert.equal((await request("/api/auth/session",{method:"POST",headers:base,body:JSON.stringify({idToken:"invalid"})})).status,401); check("forged Firebase token rejected");
 assert.equal((await request("/api/auth/session",{method:"POST",headers:base,body:JSON.stringify({idToken:"a".repeat(20000)})})).status,413); check("oversized body rejected");
 const unverified=await identity("unverified@example.test",false,"super_admin");
 assert.equal((await signIn(unverified)).status,403);
 assert.equal((await db.doc("businesses/sadboi/memberships/"+unverified.uid).get()).exists,false);check("unverified invitation cannot be claimed");
 const outsider=await identity("outsider@example.test");
 assert.equal((await signIn(outsider,{role:"super_admin",businessId:"sadboi"})).status,403);check("unapproved account cannot self-promote");
 const owner=await identity("owner@example.test",true,"super_admin");
 const accepted=await signIn(owner);
 assert.equal(accepted.status,200,await accepted.clone().text());
 const ownerCookie=session(accepted);
 assert.match(accepted.headers.get("set-cookie"),/HttpOnly/i);
 assert.match(accepted.headers.get("set-cookie"),/SameSite=Strict/i);
 assert.match(accepted.headers.get("set-cookie"),/Max-Age=43200/i);check("verified staff receives bounded HttpOnly session");
 assert.equal((await status(ownerCookie)).status,200);check("session grants staff access");
 assert.equal((await request("/admin",{headers:{Cookie:ownerCookie}})).status,200);check("staff dashboard renders");
 const invite=(await db.doc("businesses/sadboi/staffInvites/"+createHash("sha256").update(owner.email).digest("hex")).get()).data();
 assert.equal(invite.status,"claimed"); assert.equal(invite.claimedBy,owner.uid); check("invitation binds to verified UID");
 const legal=await identity("legal@example.test",true,"legal");
 const legalSession=await signIn(legal,{role:"super_admin"});
 assert.equal((await legalSession.clone().json()).staff.role,"legal");
 const legalCookie=session(legalSession); check("request role cannot override assigned role");
 redirected(await request("/admin/settings",{headers:{Cookie:legalCookie}}),"/admin");check("legal cannot access workspace settings");
 redirected(await request("/admin/artworks/new",{headers:{Cookie:legalCookie}}),"/admin");check("legal cannot create artwork");
 if(process.argv.includes("--workspace")) { const {workspaceChecks}=await import("./workspace-integration.mjs"); await workspaceChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--contacts")) { const {contactsChecks}=await import("./contacts-integration.mjs"); await contactsChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--artworks")) { const {artworkChecks}=await import("./artwork-integration.mjs"); await artworkChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--inventory")) { const {inventoryChecks}=await import("./inventory-integration.mjs"); await inventoryChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--purchasing")) { const {purchasingChecks}=await import("./purchasing-integration.mjs"); await purchasingChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--store-orders")) { const {storeOrderChecks}=await import("./store-orders-integration.mjs"); await storeOrderChecks({request:checkoutRequest,csrf,ownerCookie,db,check,origin}); }
 if(process.argv.includes("--fulfillment")) { const {fulfillmentChecks}=await import("./fulfillment-integration.mjs"); await fulfillmentChecks({request:checkoutRequest,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin}); }
 if(process.argv.includes("--store-payments")) { const {storePaymentChecks}=await import("./store-payments-integration.mjs"); await storePaymentChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin,paymentSecret}); }
 if(process.argv.includes("--gallery")) { const {galleryChecks}=await import("./gallery-integration.mjs"); await galleryChecks({request,csrf,ownerCookie,legalCookie,db,check,origin}); }
 if(process.argv.includes("--order-lifecycle")) { const {orderLifecycleChecks}=await import("./order-lifecycle-integration.mjs"); await orderLifecycleChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin,paymentSecret,expirySecret,stripe}); }
 if(process.argv.includes("--order-emails") || process.argv.includes("--order-emails-disabled")) { const {orderEmailChecks}=await import("./order-emails-integration.mjs"); await orderEmailChecks({request:checkoutRequest,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin,paymentSecret,expirySecret,email,stripe}); }
 if(process.argv.includes("--shipping")) { const {shippingChecks}=await import("./shipping-integration.mjs"); await shippingChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin,stripe}); }
 if(process.argv.includes("--after-sales")) { const {afterSalesChecks}=await import("./after-sales-integration.mjs"); await afterSalesChecks({request,csrf,ownerCookie,legalCookie,identity,signIn,session,db,check,origin,stripe,expirySecret}); }
 await db.doc("businesses/sadboi/memberships/"+legal.uid).update({status:"revoked"});
 assert.equal((await status(legalCookie)).status,401);
 assert.equal((await signIn(legal)).status,403);check("revoked membership blocks sessions and re-entry");
 const accountant=await identity("accountant@example.test",true,"accounting");
 const accountantCookie=session(await signIn(accountant));
 redirected(await request("/admin/artworks",{headers:{Cookie:accountantCookie}}),"/admin");check("accounting cannot access artwork");
 await auth.updateUser(accountant.uid,{disabled:true});
 assert.equal((await status(accountantCookie)).status,401);check("disabled user loses access");
 await delay(1100);
 const logoutProof=await csrf();
 const logout=await request("/api/auth/session",{method:"DELETE",headers:{"Content-Type":"application/json",Origin:origin,Cookie:ownerCookie+"; "+logoutProof.cookie,"X-CSRF-Token":logoutProof.token},body:"{}"});
 assert.equal(logout.status,200);
 assert.match(logout.headers.get("set-cookie"),/Max-Age=0/i);
 assert.equal((await status(ownerCookie)).status,401);check("logout clears cookie and revokes copied session");
 await auth.deleteUser(owner.uid);
 const recreated=await identity(owner.email,true);
 assert.equal((await signIn(recreated)).status,403);check("claimed invitation cannot grant a replacement UID access");
 console.log(passed+" integration checks passed.");
} catch(error) {
 console.error(log);
 throw error;
} finally {
 server.kill();
 stripe?.server.close();
 email?.server.close();
 await db.terminate();
 await delay(500);
}
