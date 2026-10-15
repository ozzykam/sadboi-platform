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

Run `pnpm test:product-pages` for the product-page integration suite against disposable Auth, Firestore and Storage emulators. To inspect its fixtures, run `pnpm exec firebase emulators:exec --only auth,firestore,storage --project demo-sadboi-platform "node scripts/auth-integration.mjs --product-pages --product-preview"`. This keeps the shop open on `http://localhost:3102`; create `web-app/.next-auth-test/product-preview.done` to finish the preview. No live inventory is created or modified.

All **32 combined authentication/product-page integration checks passed**, covering public metadata and fields, safe stock availability, crawlable links, stable addresses after renaming, empty/sold-out variants, and withdrawal of private/archived pages and images. Chrome checks covered quick view, product-page links, adding two different products to one cart, persisted cart after reload, 390px reflow without horizontal page overflow, and image-viewer Escape/focus restoration. No browser errors were captured. No live business records were changed and no test orders were submitted.
