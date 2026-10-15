# Curated shop collections

Super admins manage collections at `/admin/collections`. The table uses the contacts/inquiries table design. Choose **New collection**, enter a name and description, add already-public products and artwork, and use the arrow buttons to arrange each list. Lower collection display-order numbers appear first in the shop navigation.

**Save draft** stores private changes. **Publish collection** (or **Update published collection**) separately publishes the saved snapshot. Editing a published collection does not change its public page until publication. Each collection has a stable `/shop/collections/[id]` address, its own sharing metadata and canonical URL, and a sitemap entry when production indexing is enabled. The shop sidebar links to published collections. Collection pages use the existing full-catalog cart, preserving products added elsewhere.

**Unpublish** withdraws the public page. **Archive collection** withdraws it and hides the admin row unless **Include archived collections** is checked. **Restore draft** restores editing without republishing. No products, stock, artwork or payments are deleted or changed by these actions.

Only active public products and published gallery artwork may be published as members. Each request rechecks current item visibility: private, archived or unpublished members disappear even if the collection remains published. If every member is withdrawn, the collection returns 404 and disappears from shop navigation and the sitemap. Republished members can reappear in the existing published collection. A draft may be empty; publication requires at least one eligible item. Each collection supports up to 100 products and 100 artworks, ordered separately.

Writes require super-admin access, same-origin CSRF protection and the saved revision. Actor-scoped operation receipts make unchanged retries idempotent, reject operation-ID reuse with different content and prevent stale changes from overwriting another session. Each successful action records an audit event. Browser dialogs warn before discarding unsaved changes. How-to instructions and examples are available at `/admin/how-to#collections`.

## Verification

Run `pnpm test:collections` against disposable Auth, Firestore and Storage emulators. Coverage includes role restrictions, CSRF, strict inputs, draft privacy, duplicate retries, concurrent edits, explicit publication, ordered members, metadata, withdrawal, archive and restoration. Domain tests cover command schemas, membership limits and collection sitemap URLs.

For a browser preview, run `pnpm exec firebase emulators:exec --only auth,firestore,storage --project demo-sadboi-platform "node scripts/auth-integration.mjs --product-pages --collections --collection-preview"`. The script prints public and admin URLs on localhost:3102. Create `web-app/.next-auth-test/collection-preview.done` to finish. This uses disposable fixtures only.

The emulator suite reached its browser preview after all collection assertions passed. Chrome verification covered the admin table and centered dialog, draft saving, reordering and explicit publication, desktop and 390px mobile layouts, adding to the cart, and retaining a cart item after removing it from the browsed collection. No live business records were changed and no orders were submitted.

Final `pnpm check` passed: type checking, lint, 138 domain tests, seven credential tests, two Firebase runtime tests and the production build. `SADBOI_AUTH_TEST=1` kept build output separate from the running development server.

Search/sort expansion, discounts, scheduled launches, merchant structured data and live payment activation remain separate work.
