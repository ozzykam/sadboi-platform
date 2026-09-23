# Vercel deployment

The application supports the `FIREBASE_ADMIN_CREDENTIALS` server environment variable. It accepts the complete downloaded Firebase service-account JSON; it does not require a credential file in the repository. This adds hosting support without changing the staff sign-in or order workflows.

## Project settings

Import the private `ozzykam/sadboi-platform` GitHub repository and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Next.js |
| Root Directory | `web-app` |
| Include source files outside the Root Directory in the Build Step | Enabled: the app needs `core` and `firebase.web.config.json` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` (runs the web app's Next.js build from `web-app`) |
| Output Directory | Leave the Next.js default |
| Node.js Version | `24.x`, matching `.nvmrc` |

These settings follow Vercel's [monorepo guidance](https://vercel.com/docs/monorepos/monorepo-faq) and [Node.js runtime guidance](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Keep the root lockfile and workspace manifest in the repository.

## Production environment

In Vercel, open the project, then Settings → Environment Variables. Scope these values to **Production**:

| Variable | Value |
| --- | --- |
| `SADBOI_MODE` | `staff` |
| `SADBOI_AUTH_ENV` | `live` |
| `SADBOI_APP_ORIGIN` | The exact stable HTTPS production origin, without a trailing slash or path |
| `FIREBASE_ADMIN_CREDENTIALS` | The entire service-account JSON for project `sadboi-platform`, saved as a Secret/Sensitive value |

Example origin only: if the assigned production domain is `your-project.vercel.app`, use `https://your-project.vercel.app`. Use the real domain assigned to this project, not a per-deployment URL. The exact origin is required for session and mutation protection; a different alias can display pages but cannot submit staff/cart changes successfully.

Paste the JSON object as the secret's value, from its opening `{` through its closing `}`. Do not add shell assignments, code fences, or extra surrounding quotes. The downloaded JSON's `\n` key escapes are supported. The parser validates the service-account type, required fields, matching project, and private-key syntax. Configuration errors never include the supplied credential text. A missing secret on Vercel fails clearly instead of attempting to use a developer's local login.

The public web app registration is already imported from `firebase.web.config.json`; separate `NEXT_PUBLIC_FIREBASE_*` variables are not used. Do not prefix the admin secret with `NEXT_PUBLIC_`, commit the downloaded JSON, or copy local gcloud credentials into Vercel. No actual credentials are stored in this guide or the example environment file.

Remove all emulator variables from Vercel: `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`, and `STORAGE_EMULATOR_HOST`. Leave `SADBOI_AUTH_TEST` unset. `SADBOI_PAYMENT_WEBHOOK_SECRET` remains a separate future payment-integration setting; deploying does not activate Stripe.

Production variables should not be shared with Preview deployments. Separate preview/staging Firebase bindings still need implementation. The initial deployment is for testing the existing foundation; the remaining payment/fulfillment defects in [build resumption findings](32-build-resume.md) still prevent a complete paid-store launch.

Changes to Vercel environment variables apply to new deployments. Save the variables, then deploy the commit containing this support or redeploy that commit. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Firebase and first verification

1. In Firebase project `sadboi-platform`, open Authentication → Settings → Authorized domains and add the production hostname, without `https://` or a path. Keep the existing email/password provider and staff memberships.
2. The service account must have the Firebase Authentication, Firestore, and bucket access needed by the app. This change does not create a service account, generate a key, or grant IAM permissions. The account's project must match the public registration. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).
3. Deploy, then open `/`, `/sign-in`, and `/shop` on the configured production origin. The shop may be empty when no products are published. It must not show a server error.
4. Confirm `/api/auth/session` returns 401 without a session, and `/admin` redirects to sign-in. These read-only checks do not create test orders or business records.
5. Use an existing approved staff account to sign in, open Artwork/Inventory, and verify access to an existing private image. Confirm verification/reset-email links return to an authorized domain. Do not create test orders against live inventory.

For sign-in and recovery steps, use [staff sign-in](09-staff-sign-in.md). Firebase documents [authorized domains and email actions](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions).

## Troubleshooting and key changes

- `ERR_REQUIRE_ESM` while loading `firebase-admin/auth`: production logs on 2026-09-23 showed `jwks-rsa@4.1.0` synchronously requiring the ESM-only `jose@6.2.12`. The homepage loaded, but Shop, Gallery, and Sign-in returned 500. The version-specific pnpm patch in `patches/jwks-rsa@4.1.0.patch` loads `jose` with `await import()` inside the existing async key resolver. Commit the patch, `pnpm-workspace.yaml`, and lockfile together, then deploy. This preserves the installed cryptography library versions. Reassess the patch when upgrading `jwks-rsa`; upstream tracking: [Firebase issue 3181](https://github.com/firebase/firebase-admin-node/issues/3181).
- A build cannot resolve `@sadboi/core` or the JSON registration: check Root Directory, workspace installation, and the outside-source setting.
- A missing/invalid credential error: replace the Vercel secret with the complete service-account JSON for this project, then redeploy. Do not paste the key into logs or support messages.
- Permission denied after the key parses: inspect the service account's IAM permissions. Successful parsing does not prove the account is enabled or authorized.
- Sign-in succeeds in Firebase but saving the app session fails: use the exact configured `SADBOI_APP_ORIGIN` and confirm it has no trailing slash.
- Rotate a key by saving its replacement in Vercel, deploying, and verifying the replacement before revoking the old key. Redeployments are needed because initialized server processes cache their credential.
- Local development: leave `FIREBASE_ADMIN_CREDENTIALS` unset to retain gcloud application-default credentials. Emulator mode ignores it completely.

## Verification scope

`pnpm test:firebase-config` tests SDK initialization with a generated disposable key, escaped newlines, local ADC fallback, missing Vercel configuration, emulator isolation, redacted validation errors, and project mismatch. It never requests access tokens or contacts live Firebase. `pnpm check` includes this suite. Emulator auth tests verify existing session behavior separately.

`pnpm test:firebase-runtime`, also included in `pnpm check`, disables synchronous `require(ESM)` to reproduce the production loading restriction. It checks server SDK imports and resolves a disposable RSA signing key through Firebase's installed JWKS dependency, verifying valid and tampered signatures without network access.

Actual Vercel build, IAM access, production sign-in, and private-image access need verification against the deployed project. Local checks alone do not establish a successful deployment.
