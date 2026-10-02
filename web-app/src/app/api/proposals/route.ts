import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryStaff, inventoryFailure } from "@/server/inventory";
import { proposalDetail, saveProposal } from "@/server/proposals";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const staff = await inventoryStaff(), params = new URL(request.url).searchParams; return authResponse(await proposalDetail({ kind: params.get("kind"), id: params.get("id") }, staff)); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await saveProposal(await protectedBody(request, 131072), staff), 201); }
  catch (error) { return inventoryFailure(error); }
}
