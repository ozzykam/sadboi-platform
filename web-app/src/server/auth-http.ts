import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authConfig } from "./firebase";
import { AccessError, cookieName } from "./staff";
import { getMode } from "./mode";
export function ensureStaffMode() {
  if (getMode() !== "staff")
    throw new AccessError(503, "unavailable", "Staff sign-in is not enabled.");
}
export async function validateMutation(request: Request) {
  ensureStaffMode();
  if (
    request.headers.get("origin") !== authConfig().origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AccessError(403, "csrf", "Refresh the page and try again.");
  const expected = (await cookies()).get(cookieName("csrf"))?.value;
  const actual = request.headers.get("x-csrf-token");
  if (
    !expected ||
    !actual ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !/^[a-f0-9]{64}$/.test(actual) ||
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    throw new AccessError(403, "csrf", "Refresh the page and try again.");
}
export async function boundedBody(request: Request, maxBytes: number) {
  const sizeHint = Number(request.headers.get("content-length"));
  if (sizeHint > maxBytes)
    throw new AccessError(413, "too-large", "The upload is too large.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new AccessError(400, "invalid-request", "Invalid request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AccessError(413, "too-large", "Request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function protectedBody(
  request: Request,
  maxBytes = 16384,
): Promise<Record<string, unknown>> {
  await validateMutation(request);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new AccessError(415, "content-type", "JSON is required.");
  const bytes = await boundedBody(request, maxBytes);
  try {
    const data: unknown = JSON.parse(bytes.toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new AccessError(400, "invalid-request", "Invalid request.");
  }
}
export function authResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function authFailure(error: unknown) {
  if (error instanceof AccessError)
    return authResponse(
      { error: error.message, code: error.code },
      error.status,
    );
  const code = (error as { code?: string }).code ?? "";
  if (
    [
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/argument-error",
      "auth/user-disabled",
      "auth/user-not-found",
    ].includes(code)
  )
    return authResponse(
      { error: "Sign in again to continue.", code: "invalid-session" },
      401,
    );
  console.error("Staff authentication service failed", {
    code: code || "service-unavailable",
  });
  return authResponse(
    {
      error: "Sign-in is temporarily unavailable. Please try again.",
      code: "unavailable",
    },
    503,
  );
}
