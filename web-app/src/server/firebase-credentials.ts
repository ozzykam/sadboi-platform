import "server-only";
import { applicationDefault, cert, type Credential } from "firebase-admin/app";

type CredentialEnvironment = {
  FIREBASE_ADMIN_CREDENTIALS?: string;
  VERCEL?: string;
};

/** Reads only server-side credentials. Never return this configuration to clients. */
export function firebaseCredential(
  config: { emulator: boolean; projectId: string },
  environment: CredentialEnvironment = {
    FIREBASE_ADMIN_CREDENTIALS: process.env.FIREBASE_ADMIN_CREDENTIALS,
    VERCEL: process.env.VERCEL,
  },
): Credential | undefined {
  // Tests must never parse or use a live key, even if one is inherited.
  if (config.emulator) return undefined;

  const raw = environment.FIREBASE_ADMIN_CREDENTIALS;
  if (raw === undefined) {
    if (environment.VERCEL === "1") {
      throw new Error(
        "Set FIREBASE_ADMIN_CREDENTIALS in the Vercel environment and redeploy.",
      );
    }
    // Preserve local gcloud credentials and Google-hosted service identities.
    return applicationDefault();
  }

  let account: unknown;
  try {
    account = JSON.parse(raw);
  } catch {
    // JSON parser errors can contain fragments of the private key.
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS must contain valid service-account JSON.",
    );
  }
  if (!account || typeof account !== "object" || Array.isArray(account)) {
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS must contain a service-account JSON object.",
    );
  }
  const fields = account as Record<string, unknown>;
  if (
    fields.type !== "service_account" ||
    typeof fields.project_id !== "string" ||
    typeof fields.client_email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(fields.client_email) ||
    typeof fields.private_key !== "string" ||
    !fields.private_key.trim()
  ) {
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS must include the service-account type, project_id, client_email, and private_key.",
    );
  }
  if (fields.project_id !== config.projectId) {
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS must belong to the project in firebase.web.config.json.",
    );
  }

  try {
    return cert({
      projectId: fields.project_id,
      clientEmail: fields.client_email,
      privateKey: fields.private_key.replace(/\\n/g, "\n"),
    });
  } catch {
    // Keep SDK diagnostics and credential values out of logs and responses.
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS contains an invalid service-account private key.",
    );
  }
}
