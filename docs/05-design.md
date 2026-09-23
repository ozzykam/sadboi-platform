# Design direction

## Visual character

An artist's archive with the care of a printed exhibition catalog: large artwork, deliberate typography, asymmetric composition, fine white rules, and restrained dark-red accents. Charcoal frames the art; generous space and occasional warm-white surfaces keep the experience from feeling oppressive. Let Joel's artwork supply the strongest color and texture.

The user's references are [Hedstrom Art](https://hedstrom-art.com/) and the [INPRNT gallery](https://www.inprnt.com/gallery/joelh1212/). These inform content and artwork selection. A final visual composition should be reviewed with original, authorized artwork files; this document is a design brief, not a completed screenshot or prototype.

| Token | Starting value | Use |
| --- | --- | --- |
| Main charcoal | `#191A1C` | Site canvas, header, artwork surrounds |
| Raised charcoal | `#26272B` | Panels, navigation overlays, restrained surfaces |
| Oxblood | `#7E2635` | Selected accents, button fills, section details |
| Brighter red | `#C56872` | Candidate accent on dark backgrounds; validate final contrast |
| Crisp white | `#F7F6F2` | Main type, key rules, white sections |
| Muted text | `#BAB7B3` | Supporting copy on charcoal |
| Fine rule | White with contextual opacity | Dividers and alignment cues; essential boundaries use sufficient contrast |

These are starting tokens, not a claim that every possible pairing passes contrast. Use white text on dark-red controls only after measurement. Avoid dark red for small body text on charcoal. Financial statuses use text/icons as well as color and do not depend on the brand red to communicate meaning.

Use an expressive editorial display typeface for a few headings and a highly legible sans serif for body copy, prices, navigation, and dashboard controls. Confirm font licensing before bundling. Typography remains readable at narrow widths; labels do not turn into tiny uppercase decoration.

## Homepage sequence

1. **Opening artwork.** A curated work occupies most of the first viewport, with a small Sadboi wordmark, the artist's name, a short line of context, and an obvious “Explore the art” action. Keep “Shop” visible in navigation. A fine white frame or rule and one restrained red accent give the composition structure. Do not cover important artwork with a large marketing slogan.
2. **Selected works.** A paced sequence of large images with title/year captions. Alternate scale and alignment on wider screens; preserve each artwork's intended aspect ratio and reading order on mobile. “View all work” leads to the archive.
3. **Latest collection.** A concise shoppable selection with price, available variants, edition information, and a direct route to the product. Artwork pages can say “Available as a print” without requiring every artwork to have a product.
4. **Appearances and collaborations.** Upcoming gallery/convention cards followed by editorial features for commercial collaborations. Show partner, project, year, and a story/detail link. A licensed card illustration or mouse-pad collaboration can be featured without a purchase button or fabricated stock.
5. **Artist and studio updates.** A brief introduction, commission/licensing inquiry links, and optional mailing-list signup. Consent is separate from checkout and never preselected.

Use a static, well-composed hero as the baseline. Optional motion can reveal captions/rules or gently transition a curated artwork sequence with manual controls. Respect reduced motion; keep content usable with animation disabled. Avoid mandatory intro screens, scroll hijacking, custom cursors, glitch effects, aggressive parallax, and looping video that delays access to the artwork.

## Public information architecture

| Page | Purpose and mobile behavior |
| --- | --- |
| `/` | Editorial introduction and homepage sequence above |
| `/art` and `/art/[slug]` | Search/filter by series or theme, accessible image viewer, artwork story/credits, related work, optional shop link |
| `/collections/[slug]` | Curated artwork/shop collection with clear distinction between viewable work and purchasable products |
| `/shop`, `/shop/[slug]` | Product discovery, variant selection, print/material detail, shipping/lead-time information, stock state, add to cart |
| `/cart`, `/checkout` | Clear totals and fulfillment options; minimal distraction; address and payment errors close to their fields |
| `/collaborations` and detail pages | Partner work, credits, project imagery, story, and verified external links |
| `/appearances` and detail pages | Upcoming/past events, local date/time, venue, accessibility/details when available, and links |
| `/about`, `/journal` | Artist biography and selected news/process stories |
| `/commissions`, `/licensing`, `/contact` | Scoped inquiries with useful brief fields and clear next steps |
| `/account` | Orders, invoices, commissions, approvals, and protected deliveries |
| `/sign` | Focused invitation/signature flow with readable agreement and downloadable copies |

Keep principal mobile navigation small: Art, Shop, Studio, and menu/account/cart access. Studio groups collaborations, appearances, about, and updates. Links and product selection work by tap/keyboard; no information requires hover.

## Mobile commerce

Product pages lead with accurate art/product images. Show full-art views separately from framed/merchandise mockups so patrons know what they are buying. Display size, paper/material, framing inclusion, edition terms, price, availability, and fulfillment estimate before purchase.

Use a sticky add-to-cart action where it does not cover content or system safe areas. Variant choices are large, labeled controls, with unavailable options explained. Cart editing and removal are easy to undo. Guest checkout is a first-class path. Preserve entered data when validation fails and show a clear pending-payment state when confirmation is delayed.

Small-screen shipping, pickup, returns, sold-out, preorder, and made-to-order states must be designed explicitly. Do not show countdowns or scarcity claims unless they reflect actual publication/edition/inventory data.

## Dashboard and POS

Use the same visual identity with calmer, denser layouts suited to daily work. Offer a light reading surface for contracts/financial tables and a usable light dashboard theme. Critical controls remain readable outdoors at a convention.

Group navigation into Overview, Art & Products, Sales & Fulfillment, Commissions & Projects, Licensing, Events & Galleries, Finance, Contacts, Publishing, and Settings. On phones, prioritize a small bottom navigation for Home, Work, Sell, and More; keep full modules in the menu. Search and a context-sensitive create action are always reachable.

The overview shows actionable queues before charts: orders awaiting packing, client reviews, overdue balances, stock exceptions, upcoming appearances, expiring agreements, and failed jobs. Summary cards always identify date range, currency, and what metric they represent.

On narrow screens, turn operational rows into labeled cards with drill-down details; keep wide financial tables in dedicated labeled scroll containers or focused detail screens. Filters open as accessible sheets, persist in the URL where appropriate, and include a clear reset. Do not silently hide important columns with no alternate view.

Build quick tasks around one-handed use: find/scan an SKU, record receiving, update packing, take an event payment, photograph an expense receipt, inspect a commission proof, and check a settlement. POS uses large totals, clear selected event/location, device/payment status, and a visible completed receipt. Prevent repeated payment taps while an attempt is unresolved.

## Accessibility and performance acceptance

- Start at 360px and verify 320px reflow, common phone widths, tablets, and desktop. Test portrait/landscape and enlarged text.
- Use a 44px target-size design goal, visible keyboard focus, logical headings, labeled controls, and accessible dialogs. Validate contrast to WCAG 2.2 AA and test with keyboard and screen reader. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- Treat artwork alt text as editorial content, not an automatic copy of the filename. Interactive image viewing supports zoom and accessible close/next controls.
- Honor reduced motion, avoid flashing effects, maintain standard browser scrolling and pinch zoom.
- Ship responsive image derivatives with dimensions, lazy-load below the fold, prioritize the actual hero, and keep master files private. Server-render public content and isolate optional animation code.
- Target good Core Web Vitals (LCP at most 2.5s, INP at most 200ms, CLS at most 0.1 at the 75th percentile); validate lab results and later real-user data. These are acceptance targets, not measured results. [Web Vitals guidance](https://web.dev/articles/vitals)
- Test loading, empty, error, pending, disabled, sold-out, expired invitation, and permission-denied states along with the happy path.

## Design deliverables during implementation

Create token/type specimens, then mobile and desktop compositions using Joel's actual art for: homepage, artwork detail, product detail, checkout, dashboard overview, POS, commission review, and agreement signing. Review hierarchy and readability before building secondary screens. Verify the running implementation at real viewport sizes; do not substitute a desktop mockup scaled down for a mobile layout.
