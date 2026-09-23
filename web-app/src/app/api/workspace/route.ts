import { authResponse, protectedBody } from "@/server/auth-http";
import { authFailure } from "@/server/auth-http";
import {
  workspaceDirectory,
  saveStaffInvite,
  actOnInvite,
  actOnMembership,
  workspaceStaff,
} from "@/server/workspace";
export const runtime = "nodejs";
export async function GET() {
  try {
    await workspaceStaff();
    return authResponse(await workspaceDirectory());
  } catch (error) {
    return authFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await workspaceStaff(),
      body = await protectedBody(request, 16384),
      action = new URL(request.url).searchParams.get("action");
    if (action === "invite")
      return authResponse(await saveStaffInvite(body, staff), 201);
    if (action === "invite-status")
      return authResponse(await actOnInvite(body, staff), 201);
    if (action === "membership")
      return authResponse(await actOnMembership(body, staff), 201);
    return authResponse({ error: "Unknown workspace action." }, 400);
  } catch (error) {
    return authFailure(error);
  }
}
