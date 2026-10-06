import { authResponse, boundedBody, ensureStaffMode } from "@/server/auth-http";
import { authConfig } from "@/server/firebase";
import { AccessError } from "@/server/staff";
import { accessAgreement } from "@/server/agreement-access";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    ensureStaffMode();
    if (
      request.headers.get("origin") !== authConfig().origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new AccessError(
        403,
        "origin",
        "Open the invitation on the studio website.",
      );
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw new AccessError(415, "content-type", "JSON is required.");
    const bytes = await boundedBody(request, 8192);
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new AccessError(400, "body", "Invalid request.");
    }
    return authResponse(await accessAgreement(body));
  } catch (error) {
    // Never log request bodies, invitation secrets or signature details.
    if (error instanceof AccessError)
      return authResponse({ error: error.message }, error.status);
    return authResponse(
      {
        error:
          "Agreement access is temporarily unavailable. Retry the same request.",
      },
      503,
    );
  }
}
