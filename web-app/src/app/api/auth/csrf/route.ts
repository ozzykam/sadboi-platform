import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authFailure, authResponse, ensureStaffMode } from "@/server/auth-http";
import { cookieName, cookieOptions } from "@/server/staff";
export const runtime = "nodejs";
export async function GET() {
  try {
    ensureStaffMode();
    const token = randomBytes(32).toString("hex");
    (await cookies()).set(cookieName("csrf"), token, {
      ...cookieOptions(),
      maxAge: 3600,
    });
    return authResponse({ token });
  } catch (error) {
    return authFailure(error);
  }
}
