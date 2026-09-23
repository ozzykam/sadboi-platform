# Staff sign-in

Staff authentication is implemented in `C:\Users\azizk\magkamco\sadboi-platform`.

## First sign-in

1. Run `pnpm dev` from the project root.
2. Open [staff sign-in](http://127.0.0.1:3100/sign-in). Localhost navigation automatically redirects to this canonical local address so the session cookie and CSRF origin stay consistent.
3. Choose **First visit? Create your staff account**, enter your approved email, and choose a password of at least 12 characters.
4. Use **Create account & send verification**, follow the Firebase email link, and return to sign in.

Approved super-admin addresses:
- `ozzykam@gmail.com`
- `sadboiillustration@gmail.com`

Neither account existed when this slice was set up. The live project contains pending staff activation records for these addresses. No password was assigned and no email was sent by the setup scripts. Verification and password-reset emails are sent only when the person uses the corresponding form action.

If an account already exists, sign in directly or use password recovery. If its email is not verified, sign in and select **Send verification email**.

## What is connected

- Firebase email/password authentication, account creation, email verification, and password recovery.
- In-memory browser authentication only. Passwords go to Firebase through its browser SDK; the application session endpoint receives an ID token.
- Server verification of Firebase identity, recent sign-in, verified email, and the server-owned staff record.
- A 12-hour HttpOnly, SameSite=Strict session cookie. HTTPS deployments use Secure cookies with the `__Host-` prefix.
- Sign-out revokes Firebase refresh tokens/session cookies for the user and clears local session cookies.
- Staff status and role are read on each protected server request. Disabling an account or revoking its membership removes access.
- Super-admin, legal, and accounting role boundaries on dashboard pages.
- An authenticated studio overview with role-appropriate navigation and sign-out.

The connected workspace now persists shared artwork and private images. See [shared artwork and images](10-shared-artwork.md). The original artwork preview remains available in explicitly selected development preview mode.

## Configuration

The local ignored `web-app/.env.local` selects staff mode, live Firebase, and `http://127.0.0.1:3100`. It contains no private credential.

`web-app/.env.example` documents emulator configuration. Staff mode requires:
- `SADBOI_MODE=staff`
- `SADBOI_AUTH_ENV=live` or `emulator`
- `SADBOI_APP_ORIGIN`, the exact origin without a trailing slash

Live mode rejects emulator host variables. Emulator mode is restricted to local development, fixed loopback services, and `demo-sadboi-platform`. Production requires HTTPS for staff access. Preview mode cannot run in production. Without an explicit mode, development defaults to preview and production defaults to locked.

Local server credentials were configured through `gcloud auth application-default login`, with `sadboi-platform` as the quota project. Both Firestore provisioning and Firebase Admin user lookup succeeded. Credentials remain in the Google-managed local credential store, outside this project. No service-account key was created.

A deployed server must use a suitable service identity with only the Firebase Auth/Firestore permissions it needs. Never copy a developer's local credentials into a deployment.

Vercel support now accepts the complete service-account JSON through the server-only `FIREBASE_ADMIN_CREDENTIALS` environment variable. It validates the project and key format without logging the secret; emulator mode ignores live credentials. See [Vercel deployment](33-vercel-deployment.md) for the exact build/environment settings and production verification steps. Local gcloud fallback remains available when the variable is unset outside Vercel.

## Staff access model

The one-time provisioning command is:

```powershell
pnpm staff:bootstrap --live
```

This idempotently creates the two explicitly approved super-admin activation records. Existing records are left unchanged, including claimed or revoked records.

Pending records live at `businesses/sadboi/staffInvites/{sha256(normalizedEmail)}`. Hashing is for stable IDs, not secrecy. After a verified sign-in, a transaction creates `businesses/sadboi/memberships/{uid}` and marks the invitation claimed by that UID. Memberships contain user ID, business ID, normalized email, role, status, and creation time.

A revoked membership cannot be recreated through the old invitation. Deleting and recreating an Auth account cannot reuse an invitation claimed by the previous UID. Changing a member's email requires a deliberate staff-record update. Request bodies and browser users cannot assign roles or write invitations/memberships.

Firestore and Storage client rules remain deny-all. The server uses the Admin SDK and enforces authorization in application code. Every future data action must call the authorization layer itself; a layout or hidden navigation link is not sufficient.

Legal/accounting roles are enforced and tested. Super admins can now use [Workspace access](http://127.0.0.1:3100/admin/settings) to create role-scoped invitations, record resend/revoke actions, revoke/reactivate memberships, and review the staff directory. Workspace mutations are revision-checked, session revocation calls Firebase refresh-token revocation, and management actions have actor-linked audit/operation records. The screen records invitation resend activity but does not send email; share the sign-in instructions through the business's chosen channel.

## Request protections

Session mutations require the exact configured Origin, reject cross-site fetch metadata, and require a matching random CSRF cookie/header pair. JSON bodies are limited to 16 KB. ID tokens must come from a sign-in within five minutes; session creation is limited to ten attempts per verified UID per minute through a Firestore transaction. Firebase handles email/password endpoint protections; application error messages avoid disclosing account existence.

Session APIs send no-store responses. Browser authentication uses in-memory persistence. Full navigation after sign-in/sign-out intentionally discards the client router cache.

## Validation

- `pnpm test:auth`: 24 checks passed against actual Next.js routes with Firebase Auth/Firestore emulators.
- Checked anonymous redirects, localhost-to-canonical redirects, rejection of session requests from an alternate origin, form rendering, CSRF/origin rejection, forged tokens, oversized bodies, verified invitation claims, cookie flags/lifetime, request-role injection, legal/accounting boundaries, disabled accounts, revoked memberships, logout revocation, and prevention of reusing claimed invitations.
- `pnpm check`: type checking, lint, 12 domain tests, and production build passed. A final lint/build run passed without warnings after documenting the intentional full-navigation calls.
- Live Firestore staff provisioning and Firebase Admin Auth access succeeded. Local live-mode checks returned HTTP 200 for /sign-in, HTTP 307 to /sign-in for anonymous /admin, and HTTP 401 for an anonymous session lookup.
- Browser discovery returned no connected browser. Real form interaction, email delivery/link completion, visual/mobile checks, and a real staff sign-in remain to be verified by the users.

The integration test starts a separate development server on port 3102 with a separate build directory and disposes of its server/emulators. It does not send real emails or create live test accounts.

Implementation follows [Firebase session-cookie guidance](https://firebase.google.com/docs/auth/admin/manage-cookies) and the installed Next.js authentication, route-handler, and cookie documentation. Source-business role writes and client-trusted acceptance logic were not reused.

## Local sign-in origin fix

The password authentication step could succeed while the session endpoint rejected a localhost origin because the application was configured for 127.0.0.1. In development, the sign-in page now redirects the known loopback alias on the configured port to the configured origin before authentication begins. Production keeps exact-origin enforcement, and session mutations still require the canonical origin and valid CSRF proof. No passwords or user verification settings were changed.
