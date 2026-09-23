# Shared artwork catalog and private images

This slice connects staff mode to Firestore and Cloud Storage. The original browser-only artwork preview remains available in explicit development preview mode.

## Using the library

Open [Artwork](http://127.0.0.1:3100/admin/artworks) after signing in.

1. Choose **Add artwork**, enter its details, and save.
2. On the saved record, use **Add an artwork image** to upload an original and generate its private preview.
3. Reopen the record from either super-admin account to see the same data.
4. Change its status to **Archived** when it should leave the active workflow. Archiving preserves records and images.

Artwork details include title, series, year, medium, description, tags, dimensions, color profile, rights classification, status, and private studio notes. Ready status does not publish anything.

The newest successfully uploaded image appears on the catalog card. Earlier images remain available on the record, and administrators can download each unchanged original. Search and filters apply to loaded records; use **Load more artwork** to retrieve another page. Pages contain up to 50 records in stable ID order.

The live catalog was empty during final verification. No test artwork or images were placed in the live project. Earlier local browser drafts were not automatically imported; their storage is preserved. A reviewed import workflow remains outstanding.

## Access

| Role | Artwork details | Studio notes | Private previews | Original downloads | Save/archive/upload |
| --- | --- | --- | --- | --- | --- |
| Super admin | Yes | Yes | Yes | Yes | Yes |
| Legal | Read only | No | Yes | No | No |
| Accounting | No | No | No | No | No |
| Customer or signed out | No | No | No | No | No |

Every API request checks the server session and current membership. Detail pages also check staff access. Legal responses omit internal notes before serializing data to the browser. Requests cannot supply business ownership, creator IDs, role grants, or object paths.

Firestore and Storage client rules remain deny-all. The server mediates all data/file access with the Admin SDK. Downloads use authenticated application endpoints, not public download tokens or shareable signed URLs. Responses use private/no-store caching, and image optimization is bypassed so private previews are never sent through a public image cache.

## Persistence and concurrent work

Records live at `businesses/sadboi/artworks/{id}`.

- Artwork input is validated with the existing strict core schema.
- The server assigns ownership and timestamps.
- Creation uses an actor-scoped operation ID and payload hash. Repeating the same create operation returns the existing record.
- Metadata updates use a Firestore transaction and an integer revision. A stale edit returns a conflict instead of overwriting another save. The form keeps unsaved fields and offers a link to open the saved version in another tab.
- The latest update operation is recognized on retry, avoiding duplicate revision increments.
- Image changes update the cover and image count independently from metadata revisions.
- Creation, editing, archiving, and image additions write audit events in the same Firestore transaction as the corresponding record change.

These event records are not yet a full business audit viewer or a replacement for the planned durable jobs/outbox system.

## Images

Supported inputs:
- JPEG, PNG, WebP, and single-image TIFF.
- Up to 30 MB per file and 100 megapixels.
- Up to 100 completed images per artwork.

PSD, SVG, PDF, animated images, and multi-page TIFF are not supported in this slice. Very large master-file workflows need a separate upload/processing path.

The server reads a bounded request body, decodes image content with Sharp 0.35.4, rejects unsupported/corrupt files or mismatched content types, and prepares a WebP preview with a maximum edge of 1600 pixels. Orientation is applied to the preview and image metadata is not copied into it. Original bytes are preserved, with SHA-256, dimensions, media type, size, and creation details recorded separately.

File locations use server-generated IDs and per-attempt paths. Object creation uses generation preconditions so an existing object cannot be overwritten. Asset records become readable only after both original and preview are stored and the final Firestore transaction completes.

Uploads are retryable using an actor-scoped upload ID. An in-progress attempt reserves a two-minute lease. Each attempt has a durable journal with its object paths and status. On failure, the server checks whether the transaction already committed before attempting cleanup, preventing an uncertain acknowledgement from causing a completed original to be deleted. Incomplete cleanup is recorded as pending; an automated reconciler is still to be built. A process crash can leave a private processing attempt requiring retry or reconciliation.

No public derivatives, image deletion UI, configurable cover selection, malware-scanning service, or retention/deletion automation is implemented yet. All generated previews in this slice are private.

## Local development

Existing live settings continue to work. For emulators, add all three local hosts from `web-app/.env.example`, including `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`. Live configuration rejects emulator variables, including the Google Cloud Storage emulator variable.

Commands from the project root:

```powershell
pnpm dev
pnpm check
pnpm test:artwork
```

The artwork test command starts disposable Auth, Firestore, and Storage emulators plus a separate Next development server on port 3102. It includes the existing staff authentication tests and leaves the live project untouched.

## Validation

- **59 integration checks passed**, covering staff authentication plus shared creation/reading, retry safety, concurrent edits, archiving, field filtering, role boundaries, image validation, size limits, private previews, exact original download bytes, revocation, asset/artwork binding, audit events, pagination, upload journals, and server-rendered pages.
- **12 domain tests passed**.
- Type checking, lint, and production build passed through `pnpm check`.
- Live read-only verification confirmed server access to the Firestore catalog and `sadboi-platform.firebasestorage.app` in Iowa.
- Browser discovery returned no connected browser. Visual/mobile layout, actual form interaction, and a real user upload still need browser verification.

Failure-recovery journaling is implemented; network-loss and process-crash fault injection are not yet part of the automated checks.

## Reuse

The original artwork schema and editor from this project's first slice are reused. That editor's shared input/button conventions originated in the freelancing business app. Shared persistence, server authorization, idempotency, concurrency checks, private file processing, and the integration tests are new implementations; the source projects' insecure mutation or role-write patterns were not copied.

Implementation references: [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/) and [Cloud Storage request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).

Next work includes reviewed draft import, product/print variants and production inventory, public portfolio derivatives and publishing, and the remaining business modules in the checklist.
