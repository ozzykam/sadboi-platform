# Firebase setup

Created September 16, 2026 in `C:\Users\azizk\magkamco\sadboi-platform`.

## Cloud resources

| Resource | Value |
| --- | --- |
| Project | Sadboi Studio |
| Project ID | `sadboi-platform` |
| Project number | `255196248697` |
| CLI account used | `ozzykam@gmail.com` |
| Web app | Sadboi Web |
| Web app ID | `1:255196248697:web:24c5f6382a3b866712f2a8` |
| Firestore | Native mode, Standard edition, `(default)` |
| Database location | Iowa, `us-central1` |
| Database deletion protection | Enabled |
| Point-in-time recovery | Not enabled |
| Billing | Blaze activated by the user; billing-enabled status verified |
| Cloud Storage bucket | sadboi-platform.firebasestorage.app |
| Bucket location | Iowa, US-CENTRAL1 |
| Cloud client access | Denied by deployed Firestore and Storage rules |

[Open the Firebase console](https://console.firebase.google.com/project/sadboi-platform/overview).

The project and web app were created through Firebase CLI, followed by `firebase init firestore`. The generated temporary open rules were replaced with deny-all rules and deployed successfully. No business data was migrated.

## Local configuration

- `.firebaserc` binds this directory to the new project.
- `firebase.json` configures the database, rules, indexes, and loopback-only emulators.
- `firestore.rules` denies all client reads and writes, including authenticated clients.
- `storage.rules` has the same private baseline; it is tested locally and deployed to the cloud bucket.
- `firestore.indexes.json` contains no custom indexes yet.
- `firebase.web.config.json` contains the public web registration settings retrieved from Firebase. This is client configuration, not an Admin SDK credential. The configured default bucket was subsequently verified to exist in US-CENTRAL1 after the user activated Blaze.
- Firebase CLI 15.30.1 is pinned as a workspace development dependency.
- Firebase logs and emulator state directories are ignored.

No service-account private key was created. Staff mode now uses Firebase Auth and server-owned Firestore memberships. See [staff sign-in](09-staff-sign-in.md). Shared artwork and private image storage are now connected; see [artwork setup](10-shared-artwork.md). Other business-data modules remain in development; production remains locked unless staff mode and HTTPS configuration are explicitly supplied.

## Local development and verification

Run from the project root:

```powershell
pnpm emulators
pnpm test:rules
```

Run these separately: the test command starts and stops its own emulators. Node 22.19.0 and Java 21 were used successfully; the application runtime target remains Node 24.

| Emulator | Address |
| --- | --- |
| Authentication | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8080` |
| Storage | `127.0.0.1:9199` |
| Emulator UI (interactive start) | `127.0.0.1:4000` |

Both commands explicitly select `demo-sadboi-platform`, separate from the cloud project. The rules test also rejects non-loopback hosts and any different project ID. Tests use disposable emulator accounts and records; emulator data is not exported by default.

Validation completed:
- Firestore rules compiled and were released to `sadboi-platform`.
- Cloud database inspection confirmed location, Native/Standard mode, and deletion protection.
- All 10 rules tests passed: anonymous and signed-in clients cannot read/list database records, write their own super-admin membership, download private files, or upload files.
- Emulator processes stopped after the successful test run.
- After Blaze activation, billing-enabled status and the existing default bucket were verified using the Firebase CLI login. Storage rules compiled and were released successfully.
- Live anonymous bucket listing and object download checks both returned HTTP 403; bucket IAM, bucket ACLs, and default object ACLs contained no allUsers/allAuthenticatedUsers grants. No objects were uploaded during verification.

These tests verify the closed baseline. They do not establish working staff authorization or test server Admin SDK access, which bypasses client rules and must be protected in application code.

## Remaining activation work

1. Implemented: email/password integration, verified server sessions, staff membership checks, and approved activation records for both super admins. The user enabled the provider; each person must create and verify their account. See [staff sign-in](09-staff-sign-in.md).
2. Implemented: authorized shared artwork persistence and private image storage, with emulator/live isolation. See [shared artwork](10-shared-artwork.md).
3. Completed after user activation of Blaze: verified active billing and the existing Iowa bucket, deployed private Storage rules, and checked live anonymous access denial. Expand the storage policy alongside staff/upload authorization before enabling uploads.
4. Private artwork uploads and private previews are implemented. Public derivatives, publication workflows, and reviewed local-draft import remain outstanding.
5. Set up separate staging bindings, deployment, backups/recovery, and monitoring as those workflows are implemented.

To redeploy the current private rules deliberately:

```powershell
pnpm exec firebase deploy --only "firestore,storage" --project sadboi-platform --account ozzykam@gmail.com
```

The general build checklist remains unchecked where a larger workflow is only partially implemented.