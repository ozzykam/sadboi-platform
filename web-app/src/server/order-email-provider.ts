import "server-only";
import { authConfig } from "./firebase";
import { AccessError } from "./staff";
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
};
export function orderEmailConfig() {
  if (process.env.SADBOI_ORDER_EMAIL_MODE !== "resend") return null;
  const from = process.env.SADBOI_ORDER_EMAIL_FROM ?? "",
    key = process.env.RESEND_API_KEY ?? "";
  const replyTo = process.env.SADBOI_ORDER_EMAIL_REPLY_TO ?? "";
  const recipients = (process.env.SADBOI_ORDER_EMAIL_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const address = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  // Current commerce is test-only: never turn arbitrary checkout addresses
  // into outbound mail recipients, even when a real provider key is configured.
  if (
    !address.test(from) ||
    !key.startsWith("re_") ||
    (replyTo && !address.test(replyTo)) ||
    !recipients.length ||
    recipients.some((value) => !address.test(value))
  )
    throw new AccessError(
      503,
      "email-config",
      "Configure the email sender, provider key, and approved test recipients before processing emails.",
    );
  const port = process.env.SADBOI_EMAIL_TEST_PORT;
  if (
    port &&
    !(
      authConfig().emulator &&
      process.env.SADBOI_AUTH_TEST === "1" &&
      /^\d{4,5}$/.test(port)
    )
  )
    throw new AccessError(
      503,
      "email-config",
      "The email fixture is restricted to local emulator tests.",
    );
  // Emulators must never contact the actual provider, even with inherited keys.
  if (authConfig().emulator && !port)
    throw new AccessError(
      503,
      "email-config",
      "Emulator email delivery requires a local fixture.",
    );
  return {
    from,
    key,
    replyTo,
    recipients,
    url: port
      ? `http://127.0.0.1:${port}/emails`
      : "https://api.resend.com/emails",
  };
}
export async function submitOrderEmail(
  config: NonNullable<ReturnType<typeof orderEmailConfig>>,
  id: string,
  payload: EmailPayload,
) {
  try {
    const response = await fetch(config.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `sadboi-order-email/${id}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      return {
        status:
          response.status === 429 || response.status >= 500
            ? ("retry" as const)
            : ("failed" as const),
        error: `provider_http_${response.status}`,
      };
    const body = await response.json();
    if (typeof body.id !== "string" || !body.id || body.id.length > 200)
      return { status: "retry" as const, error: "provider_response_unknown" };
    return { status: "accepted" as const, providerId: body.id };
  } catch {
    return { status: "retry" as const, error: "provider_response_unknown" };
  }
}
