# Requirements and decisions

## Confirmed business scope

| Topic | Confirmed direction |
| --- | --- |
| Timing | No deadline. Plan the complete platform and sequence work by dependencies. |
| Existing business | Prints, custom commissions, one licensing agreement, gallery and convention sales. |
| Growth | Additional licensing, apparel, accessories, and other merchandise. |
| Print fulfillment | Transition from INPRNT to fulfillment managed by the business with local print shops. |
| In-person sales | Replace the current Venmo-centered workflow with sales and Stripe payments managed through this platform. |
| Commissions | Inquiry, qualification, quotation, agreement, deposits, milestones, revisions, approvals, invoices, and final delivery. Current practices are not yet known. |
| Artwork records | Detailed metadata, source files, versions, print specifications, editions, certificates, costs, merchandise, and license relationships. |
| Licensing | Fixed fee, royalty, or hybrid; permitted uses, exclusivity, dates, renewal, and royalty reporting. No territory-tracking module. |
| Signing | Generate agreements; unique invite code; full name and declared signing date; record evidence of agreement and preserve the exact signed version. |
| Events and galleries | Applications, bookings, contracts, scheduling, consignment, stock movement, commissions, travel/other expenses, settlements, and profit. |
| Finance | Invoices, revenue, expenses, production costs, margins, royalties, manager compensation, and accounting records. No accounting-system dependency exists. |
| Staff | Business manager and Joel are super admins. Super admins can invite scoped legal and accounting users. |
| Existing data/services | No reusable integrations or operational dataset supplied. Public portfolio and INPRNT catalog are references, not an assumed customer/order migration. |
| Public website | Explore artwork, then shop the latest collection, then appearances, collaborations, and news. |
| Project | New directory at `C:\Users\azizk\magkamco\sadboi-platform`; no new repository now. One artist initially, possible template reuse later. |

## Business capabilities

The dashboard connects records rather than creating isolated trackers. A commission can produce an artwork, an agreement, multiple invoices, revisions, expenses, and a portfolio entry. A print derives from an artwork, has production specifications and a stock-keeping variant, can be held at a gallery, and generates attributable income when sold.

| Area | Required capability |
| --- | --- |
| Dashboard | Work queues, overdue invoices, orders to fulfill, low stock, open commissions, upcoming events, expiring licenses, royalty reports due, and financial summaries with date/channel filters. |
| Contacts | People and organizations with multiple relationships: patron, collector, commission client, gallery, licensee, printer, supplier, collaborator. Notes, files, communication history, follow-up tasks, and consent preferences. |
| Artwork | Searchable archive; public/private status; title, narrative, series, year, medium/software, dimensions, resolution, color profile, tags, credits, ownership and permitted uses; versions and derivatives. |
| Catalog | Products linked to artwork; SKU variants for size/material/color; open/limited editions; collections; prices/costs; packaging; publication scheduling; discounts; stock status and production lead times. |
| Production | Printer/supplier directory, quotes, purchase orders, proofs, print-ready files, production batches, lead times, receiving, quality checks, damaged stock, reprints, and landed cost. |
| Inventory | Locations for storage, galleries, events, and in-transit goods; counts, reservations, allocations, transfers, returns, loss/damage, low-stock thresholds, and edition uniqueness. |
| Commerce | Guest and account checkout, Stripe payments, order tracking, shipping, pickup when enabled, receipts, fulfillment queues, returns, exchanges, partial refunds, and disputes. |
| Event POS | Select event/location, scan or find SKU, build cart, take payment, issue receipt, attribute revenue and inventory, reconcile the session. Record cash or legacy Venmo manually with references where needed. |
| Projects/commissions | Brief, budget, schedule, deliverables, tasks, time logs, milestones, estimates, deposits, change orders, revision allowance, approval requests, and controlled delivery. |
| Agreements | Templates, structured terms, versions, attachments, invitations, signing, countersigning where required, amendment history, executed copies, and renewal reminders. |
| Licensing | Opportunity pipeline, linked artwork, use/category restrictions, exclusivity conflicts, fixed fees, royalty bases/rates/tiers, advances/minimum guarantees, reports, invoices, and payment reconciliation. |
| Galleries/events | Application deadlines, organizer contacts, booking state, calendar, booth/space details, contracts, packing lists, consignments, sales reports, fee splits, expected settlements, and event profit. |
| Finance | Chart of accounts, balanced journal, receivables/payables, expenses and receipts, inventory cost, processor fees, deposits and payouts, tax liabilities, royalty balances, management compensation, reconciliation, period locks, and exports. |
| Publishing | Artwork pages, collections, artist biography, collaboration case studies, appearances, journal/news, commission/license inquiry forms, SEO, share previews, and consent-based mailing-list capture. |
| Operations | Notifications, reminders, audit trail, permission management, backups, restore procedure, data export, support history, and configurable business settings. |

Digital downloads can use the same protected delivery infrastructure as commissions if enabled later; their retail sale is not a confirmed product requirement. Memberships, auctions, an artist marketplace, payroll, and tax-return filing are outside this plan unless separately requested.

## Access model

| Role | Default scope |
| --- | --- |
| Super admin: manager / artist | Full business access, publication, finance, stock, agreements, refunds, invitations, and settings. Record which individual took each action. |
| Legal | Agreements, relevant contacts/artwork rights, version review, signing evidence, and legal exports. No stock edits, payment execution, or unrelated financial/personal data by default. |
| Accounting | Finance, invoices, receipts, relevant order/settlement summaries, reconciliation, and financial exports. No source-art downloads, publication, role administration, or contract edits by default. |
| Customer / commission client | Only their orders, invoices, proposals, commission updates, approval requests, and entitled downloads. |
| Invited signatory | Only the exact agreement/version and signing session authorized by their invitation. No staff dashboard access. |

Legal/accounting memberships may be time-limited and granted record-specific exceptions by a super admin. Server authorization must enforce this matrix regardless of which UI is used. Public registration never creates a staff membership.

## Defaults proposed for implementation

- One installation, one business, one base currency initially; store a currency code on every monetary record. Do not assume the business's country or currency from the developer's timezone.
- Keep Firebase Auth, Firestore, Storage, and Stripe; use a current stable Next.js/React stack and a shared domain-service layer.
- Browser POS plus a compatible Stripe smart reader; online QR checkout as another payment path. Phone-only Tap to Pay requires a supported native integration and is a separate device decision.
- Print-shop relationships begin with quotes, purchase orders, secure file handoff, and manually recorded milestones. No printer API is assumed.
- Account creation is optional for retail shopping; commission and signing access is explicitly verified and scoped.
- Use configurable products and brand content so this code can later seed another artist's separate installation.

These are architectural defaults, not additional answers attributed to the user.

## Decisions needed when their implementation begins

| Decision | Needed before | Planning treatment |
| --- | --- | --- |
| Legal entity, business country/state, base currency, tax registrations | Live invoicing, checkout, contracts | Store configurable fields; no invented tax rate or jurisdiction. |
| Printer(s), paper/ink, sizes, proofs, packaging, production lead times | Selling physical stock | Build supplier/production records and require actual specifications/costs. |
| Stock batches versus made-to-order items | Catalog availability and promise dates | Support a fulfillment policy per variant; make lead times visible. |
| Shipping countries, carriers, pricing, label provider, return address/policy | Shipping activation | Shipping adapter plus manual tracking entry; select provider after coverage is known. |
| Event devices, reader model, connection availability | Live POS | Test with a simulated reader first; validate actual hardware before an event. |
| Existing agreement and approved template terms | Live agreement generation | Preserve uploaded agreement; configure reviewed templates and signature requirements. |
| Management fee basis, royalty calculation bases, recognition/costing policies | Financial posting rules | Version policies and store their snapshots on transactions. |
| Domain, branding assets, hero artwork, public collaboration credits | Final design and publication | Use supplied portfolio as reference; use original authorized files for final assets. |
| Hosting/service budget and ownership of provider accounts | Provisioning paid services | Track hosting, storage/egress, jobs, email, payment, shipping, and device costs separately. |
| Optional legacy history worth entering | Opening balances | Manual entries/imports with provenance; no historical completeness assumed. |

These decisions do not block writing the architecture or building local foundations. No new account, purchase, email, signing invitation, or production deployment is part of this planning pass.
