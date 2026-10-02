import { authResponse, boundedBody, protectedBody } from "@/server/auth-http";
import { inventoryStaff } from "@/server/inventory";
import { inventoryFailure } from "@/server/inventory";
import { AccessError } from "@/server/staff";
import { savePublicInquiry, publicInquiryDirectory, updatePublicInquiry } from "@/server/public-inquiries";
import { ensureStaffMode } from "@/server/auth-http";
export const runtime = "nodejs";
async function jsonBody(request: Request, max: number) { try { return JSON.parse((await boundedBody(request, max)).toString("utf8")); } catch { throw new AccessError(400, "invalid-request", "Invalid request."); } }
export async function POST(request: Request) { try { ensureStaffMode(); return authResponse(await savePublicInquiry(await jsonBody(request, 32768), request), 201); } catch (error) { return inventoryFailure(error); } }
export async function GET() { try { const staff = await inventoryStaff(); return authResponse(await publicInquiryDirectory(staff)); } catch (error) { return inventoryFailure(error); } }
export async function PATCH(request: Request) { try { const staff = await inventoryStaff(true); return authResponse(await updatePublicInquiry(await protectedBody(request, 16384), staff)); } catch (error) { return inventoryFailure(error); } }
