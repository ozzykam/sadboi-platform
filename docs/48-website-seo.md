# Website SEO and search settings

The user reverted the visual homepage expansion and requested SEO instead. The original entrance design is preserved. The confirmed intended public domain is **https://sadboi.art**.

## Implemented scope

- Super-admin **Workspace → Search & sharing settings**, at `/admin/settings/seo`: canonical site address, homepage title/description, Google HTML verification token, search visibility and a live illustrative search preview.
- Server-rendered public metadata: homepage, gallery, published artwork details, shop, appearances and contact. Canonical links omit filters/query strings. Open Graph and Twitter metadata use absolute URLs; artwork uses its published image and alt text. The user-supplied 1192×633 default sharing image is `/images/shared-image.webp`; `/social-image` redirects there for older preview links.
- Homepage `WebSite` JSON-LD identifies Sadboi Studios and Joel Hedstrom. JSON serialization escapes script boundaries. Existing favicons and viewport handling remain intact.
- `/robots.txt` allows crawlers to read page-level noindex directives. It advertises `/sitemap.xml` only on the enabled canonical production host. The sitemap includes five public pages and currently published gallery detail URLs, never private records or unpublished artwork. No invented modification dates or priorities.
- Root metadata stays noindex/nofollow; only explicitly supported public pages opt into indexing. Development, Vercel previews, alternate hosts, locked mode and unavailable/invalid settings remain noindex. Search visibility defaults **off**, while canonical defaults to `https://sadboi.art`.
- Strict input validation, super-admin API authorization, CSRF/origin protections, optimistic revisions, durable retry keys and atomic audit records. Public metadata receives only validated public configuration, never audit/staff details.
- In-app guide: `/admin/how-to#seo`, linked from Settings and the How-to topics.

## Storage and activation

Social-profile follow-up: the supplied Instagram (`https://www.instagram.com/sadboi_illustration/`) and X (`https://x.com/Sadboi0808`) profiles default into existing settings without requiring a data migration. Super admins can edit or clear each in Search & sharing. Visible homepage links appear beneath its main buttons, and the artist's structured data includes the profiles as `sameAs`. The X profile supplies the Twitter-card creator handle. Clearing a field removes its visible link and associated metadata. The rest of the entrance design is preserved. No social accounts are connected and no posts or embeds are created.

Settings live in `businesses/sadboi/inventoryState/seo`; idempotency receipts in `seoOperations`; before/after history in `inventoryAudit`. Existing deny-all client Firestore rules apply. No new indexes, dependencies or environment variables are required. Public configuration is memoized per render, not cached between requests, so saved metadata is available on the next request.

After deployment and domain connection, open settings, review `https://sadboi.art`, enable public search indexing, and save. Verify ownership in Google Search Console and submit `https://sadboi.art/sitemap.xml`. The admin setting does not configure DNS, attach domains, redirect www/aliases, submit a sitemap, or guarantee search rankings. Production routing must retain the public Host header for canonical-host matching. Domain aliases should be redirected through the hosting provider separately.

## Validation

- `pnpm check` passed: TypeScript, ESLint, **131 domain tests**, seven credential tests, two Firebase runtime tests and the production build.
- Social-profile follow-up: `pnpm check` passed again with **133 domain tests** and the production build. Added coverage for older saved settings, explicit link removal and unsafe/unrelated profile URLs. Chrome confirmed both exact destinations, artist `sameAs`, `twitter:creator`, and desktop/phone layouts without horizontal overflow. No live settings were written.
- Focused Auth/SEO emulator run passed **30 grouped integration checks**, covering super-admin access, CSRF, persistence, retries, concurrent edits/audits, rendered canonical/social/verification/structured metadata, private-page exclusion, unpublished-artwork withdrawal, empty development sitemap and 1200×630 sharing-image output.
- Chrome verified editing/saving/reloading, disabled Save when unchanged, keyboard visibility toggle, help navigation, desktop and 390px layout without horizontal overflow or captured console errors, generated sharing-image appearance and preserved public entrance design. Browser DOM confirmed the saved title and `https://sadboi.art` canonical. Browser tab/viewport and emulators were cleaned up.
- Initial integration assertions were corrected for documented Next.js behavior: normalized homepage canonical URLs omit the trailing slash, and streamed not-found responses may retain HTTP 200 while injecting noindex. Withdrawal checks verify no public artwork title or canonical survives.

All mutations used disposable Firebase emulator records. No production settings, DNS, hosting configuration or Search Console properties were changed. Deployment and live canonical-host/indexing verification remain pending.

## Limits

Header follow-up: the server root layout loads the validated public profile URLs and passes only those strings to the interactive client header. The header uses the existing black Instagram/X logo assets; homepage logo choices remain unchanged. This avoids importing server-only Firebase/SEO code into the browser. Root-layout data is now request-rendered. Type checking and the production build passed; Chrome verified logo loading and mobile header layout.

This is the public-site SEO foundation. It does not create standalone product pages, per-page admin overrides, editable social-image uploads, analytics, search-ranking reports, or automatic Google submission. Social platforms and search engines can retain cached metadata after updates. Disabling indexing requests eventual removal; it is not access control. Public artwork publication remains the source of gallery metadata and sitemap eligibility.

The user’s priority order remains Catalog/public website → Agreements/licensing → Business finances → In-person sales → Event preparation → Commission completion → Gallery consignment. Stripe commission collection, proof/review and previously deferred provider tasks remain paused.

Reference: [Google developer SEO guidance](https://developers.google.com/search/docs/fundamentals/get-started-developers), [site-name structured data](https://developers.google.com/search/docs/appearance/site-names), and the installed Next.js metadata, robots, sitemap and ImageResponse documentation.
