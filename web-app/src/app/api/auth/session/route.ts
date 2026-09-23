import { cookies } from "next/headers";
import { adminServices } from "@/server/firebase";
import {
  authFailure,
  authResponse,
  protectedBody,
  ensureStaffMode,
} from "@/server/auth-http";
import {
  AccessError,
  claimStaff,
  cookieName,
  cookieOptions,
  limitSessionCreation,
  sessionSeconds,
  staffForCookie,
} from "@/server/staff";
export const runtime = "nodejs";
export async function GET() {
  try {
    ensureStaffMode();
    const staff = await staffForCookie(
      (await cookies()).get(cookieName("session"))?.value,
    );
    return authResponse(
      staff ? { staff } : { error: "Sign in to continue." },
      staff ? 200 : 401,
    );
  } catch (error) {
    return authFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await protectedBody(request);
    if (typeof body.idToken !== "string" || body.idToken.length > 12000)
      throw new AccessError(
        400,
        "invalid-request",
        "A sign-in token is required.",
      );
    const { auth } = adminServices();
    const token = await auth.verifyIdToken(body.idToken, true);
    const elapsed = Date.now() / 1000 - token.auth_time;
    if (!Number.isFinite(elapsed) || elapsed > 300 || elapsed < -30)
      throw new AccessError(
        401,
        "recent-sign-in",
        "Sign in again to continue.",
      );
    await limitSessionCreation(token.uid);
    const staff = await claimStaff(token);
    const session = await auth.createSessionCookie(body.idToken, {
      expiresIn: sessionSeconds * 1000,
    });
    (await cookies()).set(cookieName("session"), session, {
      ...cookieOptions(),
      maxAge: sessionSeconds,
    });
    return authResponse({ staff });
  } catch (error) {
    return authFailure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    await protectedBody(request);
    const jar = await cookies();
    const staff = await staffForCookie(jar.get(cookieName("session"))?.value);
    if (staff) await adminServices().auth.revokeRefreshTokens(staff.uid);
    jar.set(cookieName("session"), "", { ...cookieOptions(), maxAge: 0 });
    jar.set(cookieName("csrf"), "", { ...cookieOptions(), maxAge: 0 });
    return authResponse({ ok: true });
  } catch (error) {
    return authFailure(error);
  }
}
