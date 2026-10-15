# Public catalog foundation

Updated October 14, 2026.

Products and variants now have a Publication setting: Private or Public catalog. `/shop` reads only active public products and active public variants. Stocked variants show online-eligible available units after reserved, allocated, and unavailable quantities are removed; made-to-order variants show their fulfillment mode.

Publishing does not create orders or reduce stock. The existing cart, order requests, flat-rate shipping/pickup and Stripe test checkout are separate workflows.

## Shareable product pages

Every active public product has a stable `/shop/[id]` address. Click its title in the shop or choose **Open product page** in its quick-view dialog. Artwork pages now link directly to their public products. Product renaming keeps the same address.

The page shows the published product image (or the first public variant image), description, USD prices, variant specifications and online availability. Its image can be enlarged in a keyboard-accessible dialog. Products without public active variants show an unavailable message; sold-out products remain visible with zero availability.

Choose quantities, **Add selected to cart**, then **View cart**. The page uses the same cart and checkout component as the shop, preserving other products and uncertain-order recovery. Adding items does not reserve inventory or create a payment. Checkout remains test-only.

Product-specific title, description, canonical URL and Open Graph/Twitter image metadata use the existing SEO settings. Public product URLs are included in the production sitemap when indexing is enabled. Development and preview sites stay noindex. Private and archived products return HTTP 404, and hidden variants are excluded. The shop listing skeleton is confined to its page so it cannot turn missing product responses into streamed HTTP 200s.

Staff maintain the page through Inventory → Products & variants; no new publishing switch is required. Instructions are in `/admin/how-to#catalog`. Site-wide structured data is unchanged; this slice does not claim live merchant offers or add payments, discounts, collections or publication scheduling.

## Verification

### Variation descriptions and image galleries

Saved variants now have an optional 3,000-character description and an ordered gallery of up to 12 images. Inventory supports selecting multiple JPEG/PNG/WebP files (12 MB each), saved previews and per-image removal. Uploads append transactionally; the first image remains the cover. Removing it promotes the next image. Older single-image records remain supported, and metadata saves preserve the independently managed gallery. Image files remain private storage objects; removed members no longer resolve through admin/public image routes.

The shared order form used by shop quick view, collections and dedicated product pages opens a native variation dialog from the variation name/details button. It shows description, specifications, price and availability, with previous/next arrows, thumbnail selection, arrow-key navigation and horizontal swipe for multiple images. Escape closes only the variation dialog and restores focus; quantity state stays in the parent form. Single images have no carousel controls, missing variation images can fall back to the product image, and images use the shop loading placeholder. Public requests require both the variation and its parent product to remain active/public and restrict image IDs to current gallery membership.

`pnpm test:product-pages` includes gallery regression checks for append order, legacy covers, metadata preservation, description validation, private/withdrawn access, removal of middle/cover/final images, idempotent removal and image-count limits. How-to instructions are in `/admin/how-to#catalog`.

All **39 combined authentication/product-page/gallery integration checks passed**. Chrome verification covered opening variation details from quick view and the product page, next-image and thumbnail controls, arrow-key navigation, Escape closing only the variation dialog with focus restored, preserved quantity, 390px reflow without horizontal overflow, and editing a description in Inventory while retaining all three gallery images. Uploads/removals were exercised by the emulator suite; browser file-picker permission remains unavailable. Touch-swipe behavior is implemented but has not been checked on physical touch hardware. No live products or orders were changed.

The gallery build passed the complete `pnpm check`: type checking, lint, 138 domain tests, seven credential tests, two Firebase runtime tests and production build. Validation used `SADBOI_AUTH_TEST=1` to keep build output isolated from the running development server.

### Shop image persistence fix

Selecting a shop image on an existing product or variant uploads and saves it immediately. The editor shows the saved preview, upload progress and failures, and prevents Save/Close during upload. Save applies the other metadata without overwriting the uploaded image reference, even when an older form submits a missing, blank or stale reference. The uploaded storage path is authoritative; existing files affected by the earlier metadata-save bug can be displayed again without re-uploading. Versioned public image URLs prevent replacements from reusing a cached old image. Authenticated admin previews work for private records and use private/no-store responses.

The disposable emulator suite passed **34 combined authentication/product-page checks**, including first upload followed by save, replacement followed by stale metadata, blank references, legacy recovery, authenticated private previews, public withdrawal and upload CSRF. Browser verification covered the saved preview and saving/reopening after a page reload. The extension blocked file selection because local-file access is disabled, so uploads were exercised through the integration suite rather than the browser picker. No live product records were changed.

The image fix also passed the full `pnpm check`: type checking, lint, 138 domain tests, seven credential tests, two Firebase runtime tests and the production build, using isolated build output with `SADBOI_AUTH_TEST=1`.

Curated collections are now available under Admin → Collections, with draft/publish controls and ordered product/artwork membership. See [shop collections](49-shop-collections.md) for that separate slice and its verification.

Run `pnpm test:product-pages` for the product-page integration suite against disposable Auth, Firestore and Storage emulators. To inspect its fixtures, run `pnpm exec firebase emulators:exec --only auth,firestore,storage --project demo-sadboi-platform "node scripts/auth-integration.mjs --product-pages --product-preview"`. This keeps the shop open on `http://localhost:3102`; create `web-app/.next-auth-test/product-preview.done` to finish the preview. No live inventory is created or modified.

All **32 combined authentication/product-page integration checks passed**, covering public metadata and fields, safe stock availability, crawlable links, stable addresses after renaming, empty/sold-out variants, and withdrawal of private/archived pages and images. Chrome checks covered quick view, product-page links, adding two different products to one cart, persisted cart after reload, 390px reflow without horizontal page overflow, and image-viewer Escape/focus restoration. No browser errors were captured. No live business records were changed and no test orders were submitted.

Final `pnpm check` passed: type checking, lint, 135 domain tests, seven credential tests, two Firebase runtime tests and the production build. Validation used `SADBOI_AUTH_TEST=1` to keep build output separate from the running development server.
