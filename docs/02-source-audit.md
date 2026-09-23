# Source audit and reuse map

Inspected September 15, 2026. This is a targeted static audit of source trees, manifests, types, services, route handlers, and rules. Neither project was run against its live services. A source file demonstrates an implementation starting point, not verified production readiness.

## Source identifiers

| ID | Source root | Intended contribution |
| --- | --- | --- |
| B | `C:\Users\azizk\magkamco\magkam-solutions\web-app` | Business workflows, proposals, invoices, projects, contacts, tasks, time tracking, document/account screens |
| E | `C:\Users\azizk\magkamco\freelance\templates\ecommerce\base\web-app` | Catalog, cart, checkout, customer orders, fulfillment UI, Stripe/email patterns |
| N | New platform implementation | Artist-specific domains, shared transactional infrastructure, signing, production, event POS, and finance |

Paths below are relative to the indicated source root. **Reuse** means extract and validate a suitable component or pattern. **Adapt** means retain useful behavior/UI while changing its model or implementation. **New** means no suitable implementation was established during this inspection.

## Feature provenance

| Platform capability | Origin and concrete source | Treatment |
| --- | --- | --- |
| Admin shell and navigation | B `app/(admin)/layout.tsx`, `app/(admin)/admin/page.tsx` | Adapt layout, navigation, mobile action patterns, and artist-specific summaries. |
| User/account flows | B/E `lib/contexts/AuthContext.tsx`, `lib/auth-helpers.ts`, `app/(auth)` | Adapt UI; implement server-owned memberships/session authorization. |
| Shared buttons/forms/dialogs | B/E `components/ui` | Reuse accessible primitives where suitable; restyle and verify keyboard/touch behavior. |
| Prospects and contacts | B `services/prospect-service.ts`, `types/prospect.ts`, `services/contact-message-service.ts` | Adapt into contacts/organizations and relationship-based pipelines. |
| Project tracking | B `services/project-service.ts`, `types/project.ts`, `app/(admin)/admin/projects/page.tsx` | Adapt; add artwork links, deliverables, milestones, budgets, optional dates, approvals. |
| Tasks and work time | B `services/todo-service.ts`, `services/activity-service.ts` | Adapt linked tasks, time entries, reporting, and shared ownership. Activity timers are not a security audit log. |
| Proposals and invoices | B `types/invoice.ts`, `services/invoice-service.ts`, `app/(admin)/admin/proposals`, `app/(admin)/admin/invoices` | Adapt editor/display; replace money storage, counters, payment allocation, and state-changing services. |
| Invoice print/export | B `lib/templates/printable-invoice.ts`, `app/api/invoices/[id]/print/route.ts` | Adapt Sadboi branding, immutable issued snapshots, currency, taxes, credits, and PDF output. |
| Client billing pages | B `app/account/proposals`, `app/account/invoices`, `app/account/payment-history` | Adapt into a unified customer/commission portal. |
| Agreement acceptance | B `app/api/proposals/accept/route.ts` | Workflow reference only. New authenticated/versioned invite-and-sign implementation. |
| Document organization | B `services/sales-document-service.ts`, `types/sales-document.ts` | Adapt file metadata; new private vault, document versions, retention, signing evidence. |
| Product browsing | E `components/products`, `components/shop`, `services/product-service.ts`, `types/product.ts` | Adapt gallery-oriented shop and SKU variants; separate artwork from commerce. |
| Cart | E `components/cart`, `lib/contexts/CartContext.tsx`, `services/cart-service.ts` | Adapt guest/account cart and variants; server revalidates all prices and availability. |
| Checkout | E `components/checkout`, `app/(shop)/checkout/page.tsx` | Adapt address/order/payment UI; add parcel shipping, shipping/tax calculation, and secure checkout sessions. |
| Online payment | E `app/api/payment/create-intent/route.ts`, `lib/stripe/client.ts`; B `lib/stripe/server.ts`, `app/api/stripe/create-checkout-session/route.ts` | Reference Stripe integration; new shared server-priced payment commands and payment-attempt model. |
| Stripe webhook | E `app/api/webhooks/stripe/route.ts`; B `app/api/stripe/webhook/route.ts` | Reuse signature-verification concept; consolidate into a new durable, idempotent processor. |
| Order management | E `types/order.ts`, `services/order-service.ts`, `services/order-service-admin.ts`, `app/(admin)/admin/orders` | Adapt UI; separate payment, fulfillment, return, and dispute state. |
| Fulfillment | E `services/order-fulfillment-service.ts`, `services/order-fulfillment-service-admin.ts`, `app/(admin)/admin/fulfillment` | Adapt queue/history; add production, packing, parcel shipments, tracking, and split fulfillment. |
| Inventory | E `types/product.ts`, `services/product-service-admin.ts` | Basic stock field is a reference only; new per-variant/location movement and reservation model. |
| Refunds | E `services/refund-service.ts`, `types/refund.ts` | Adapt request/status UI; implement actual Stripe refund commands and webhook reconciliation. |
| Printer/supplier contacts | E `services/vendor-service.ts`, `types/vendor.ts` | Adapt contact concepts; add supplier quotes, purchase orders, proofing, and receiving. Remove public multi-vendor marketplace assumptions. |
| Wishlist/restock | E `services/wishlist-service.ts`, `components/wishlist`, `app/api/wishlist/send-restock-notifications/route.ts` | Adapt with consent and variant/location-aware availability; verify source path and permissions during extraction. |
| Public content and SEO | B/E `services/content-service.ts`, `services/seo-service.ts`, `app/robots.ts`, `app/sitemap.ts` | Adapt collaborations, appearances, artwork metadata, structured data, and publication controls. |
| Email | B/E `lib/email/email-service.ts`, `lib/email/templates` | Reuse templates/patterns; use new business identity and durable delivery jobs. |
| Analytics | B/E `features/google-analytics` | Optional adaptation; configure fresh properties and exclude private/signing/payment details. |
| Rate limiting | B `lib/utils/rate-limit.ts` | Adapt public inquiry, checkout, invite exchange, login, and download limits. |
| Artwork archive, editions, certificates | N | New domain, public gallery, private assets, and edition registry. |
| Commission approvals/delivery | B project/billing patterns + N | New client review, asset versioning, revision/change-order, and delivery workflows. |
| License management/royalties | N, with B invoice/document patterns | New rights records, conflict checks, statements, billing, and lifecycle. |
| Event calendar/consignment/settlements | N, with E order/fulfillment patterns | New event domain and location-based stock movement. |
| Stripe Terminal POS | N, with E cart/order concepts | New event checkout and reader integration. No Terminal implementation found in inspected routes or dependencies. |
| Accounting/manager compensation | N, with B invoices + E sales inputs | New ledger, expenses, reconciliation, margins, and compensation rules. |

## Findings that change the extraction strategy

| Finding from inspected source | Implication for Sadboi |
| --- | --- |
| Both manifests use Next.js `15.5.9`, React `19.1.0`, TypeScript `^5`, Tailwind `^4`, Firebase, Stripe, MUI/Emotion, Zod, React Hook Form, and Zustand. | Shared concepts are compatible. Start a current scaffold and port selected modules; do not merge manifests/lockfiles blindly. |
| B's lint script is `next lint`; E's is `eslint`. | Establish explicit ESLint, TypeScript, test, rules-test, and build commands in the new app. |
| E product type contains per-unit/per-weight pricing, one product-level stock value, and vendor fields. | Replace food-market pricing/stock assumptions with art product variants, production policy, editions, and locations. Shipping weight remains a separate useful field. |
| E fulfillment enum exposes pickup/delivery; delivery and time-slot fields dominate orders. | Parcel shipping and carrier tracking are new work, not a label change on local delivery. |
| B and E payment-intent routes accept request-body `amount` and `orderId`; those inspected handlers do not load an authorized order to calculate the amount. | Recompute prices/tax/shipping/balances on the server; verify ownership/session and expected currency before creating a payment attempt. |
| E webhook verifies Stripe signatures, then decrements stock for each success delivery without a processed-event guard in the inspected handler. | Duplicate delivery can repeat effects. Use durable receipt deduplication plus business-effect keys and atomic stock/payment posting. |
| E stock decrement uses an atomic negative increment without an availability check/reservation. | Atomic arithmetic alone does not prevent overselling. Introduce transactionally checked stock holds. |
| E success handler catches stock/fulfillment failures and still allows an acknowledgement. | Persist work before acknowledging and provide retries, failed-job visibility, and reconciliation. |
| B proposal acceptance compares a submitted email to the proposal's email without authenticating that caller in the handler. | Email equality is not identity proof. Replace this endpoint for any client acceptance/signing. |
| B Firestore rules determine role from `users/{uid}.role`, while allowing profile owners to create/update their own document without field restrictions. | The inspected rules permit role tampering. New staff membership records must be server-controlled; public profiles need field allowlists. |
| B storage rules mark several general upload paths publicly readable. | Do not route master artwork, contracts, proofs, accounting files, or deliverables through public upload paths. |
| B invoice payment recording reads an invoice and writes a new embedded payments array; the inspected function does not use a transaction. | Use separate immutable payments/allocations and atomic balance/state updates. |
| E order numbers use a four-digit random suffix. | Use stable internal IDs and transactionally allocated unique human-readable numbers. |
| E order-total helper defaults to an 8% tax rate; B invoice types contain example processing-fee/ACH-discount defaults. | Do not inherit business policy or hardcoded rates. Configure reviewed policy and use actual processor fees for reporting. |
| E `processStripeRefund` accepts an existing Stripe refund ID and updates Firestore. | This function does not itself issue a Stripe refund. Completion requires a protected provider command and status reconciliation. |

These observations apply to the inspected local code, not a claim about deployed rules or exploitability of a particular production installation. No source-project fixes were made in this planning pass.

## Extraction procedure

1. Create a fresh application inside this project with its own configuration and dependency lockfile.
2. Define shared types and invariants before porting screens that depend on them.
3. Port one feature at a time with provenance in the change notes; bring only needed modules and assets.
4. Rewrite all privileged mutations through the new authorization/domain layer. Reuse neither source project's rules unchanged.
5. Rebrand and verify extracted UI against the mobile design requirements.
6. Validate each feature with its acceptance scenario before treating it as complete.

Exclude `.git`, `.env.local`, credentials, `.firebaserc` project bindings, `node_modules`, `.next`, customer data, old business content, test/debug API endpoints, and unrelated services/job applications/calculators. Do not carry over grocer-specific time-slot/delivery assumptions. Maintain a placeholder-only environment example for fresh accounts.

## Public references

The existing [portfolio](https://hedstrom-art.com/) links to an INPRNT shop and presents an image-oriented artwork archive. The [INPRNT catalog](https://www.inprnt.com/gallery/joelh1212/) is a reference for titles and current presentation, not a reliable source of historical orders, print-ready masters, live stock, or current pricing. The fetched INPRNT page was an older crawl; confirm any imported catalog facts with Joel.

Magic: The Gathering and gaming-accessory collaborations are user-provided requirements/examples. Exact credits, licensed imagery, partner names, and publication permissions still need content verification before publication.
