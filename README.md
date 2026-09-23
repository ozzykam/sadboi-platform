# Sadboi platform

Planning baseline: September 15, 2026.

A platform for Joel Hedstrom (Sadboi) and his business manager: an art-led public website, an integrated shop, and a private dashboard for the entire art business.

Project location: `C:\Users\azizk\magkamco\sadboi-platform`.

The platform includes connected staff, artwork, inventory, purchasing/production, financial foundations, and a public shop with persistent carts and retry-safe order requests. See [implementation status and local setup](docs/07-implementation-status.md) and the [September 23 build resumption](docs/32-build-resume.md) for the recovered stopping point and next work. A dedicated Firebase project is initialized with private Firestore and Storage rules; see [Firebase setup](docs/08-firebase-setup.md).

Source repository: [ozzykam/sadboi-platform](https://github.com/ozzykam/sadboi-platform) (private), with `main` as the default branch. Local environment files, credentials, dependencies, generated builds, and logs are excluded from Git; `web-app/.env.example` and the pnpm lockfile are included. GitHub stores the source; application hosting is a separate setup step.

For hosting, use the [Vercel deployment guide](docs/33-vercel-deployment.md). The server accepts the complete service-account JSON through the private `FIREBASE_ADMIN_CREDENTIALS` environment variable; local development can continue using gcloud credentials.

## Start the application

From this directory, run pnpm install --frozen-lockfile, then pnpm dev. This machine is configured for live staff sign-in at http://127.0.0.1:3100/sign-in. See [staff onboarding and setup](docs/09-staff-sign-in.md). The original local artwork preview remains available through explicit development preview mode. Run pnpm check for type checking, lint, domain tests, and the production build; pnpm test:auth runs authentication checks, and pnpm test:artwork checks authentication plus shared artwork and private images. pnpm test:inventory includes those checks plus products, stock, and transfers. pnpm test:purchasing includes all of those plus suppliers, orders, and delivery inspection.

## Read the plan

The [public gallery and shared navbar](docs/34-public-gallery.md) add `/art`, individual artwork pages, and explicit publication from the Artwork editor. Run `pnpm test:gallery` for emulator coverage; staff instructions are in **How-to → Publish artwork to the gallery**.

The most recent continuation is [reliable public checkout and request recovery](docs/29-store-orders.md). Run `pnpm test:store-orders` for its disposable Firebase integration suite. Stripe remains deferred pending business setup. Fulfillment and payment-event lifecycle fixes are the next commerce steps.

In the signed-in platform, **How-to** (`/admin/how-to`) provides staff tutorials for creating and editing products/variants, archiving, stock counts, purchasing, supplier production progress, and inspected deliveries. Inventory and Purchasing link directly to the relevant sections. Available to super admins and accounting. Every new feature or workflow change must include its in-app tutorial under the feature build guide below.

| Document | Purpose |
| --- | --- |
| [Supplier production](docs/15-supplier-production.md) | Per-SKU progress, delivery forecasts, outstanding work queue, and update history |
| [Workspace access](docs/16-workspace-access.md) | Staff invitations, memberships, revocation, reactivation, audit, and recovery |
| [Contacts](docs/17-contacts.md) | People, organizations, relationships, notes, follow-ups, and archive behavior |
| [Feature build guide](docs/14-feature-build-guide.md) | Completion criteria and a required in-app how-to for every feature |
| [Suppliers and purchasing](docs/13-purchasing.md) | Supplier directory, draft/placed orders, inspected deliveries, and inventory updates |
| [Counts and replenishment](docs/12-stock-counts-and-replenishment.md) | Product setup guidance, physical counts, discrepancy history, and low-stock thresholds |
| [Products and inventory](docs/11-inventory.md) | Shared products/SKUs, location balances, receiving, quarantine, transfers, and validation |
| [Shared artwork and images](docs/10-shared-artwork.md) | Live catalog, private uploads, permissions, limits, and 59 integration checks |
| [Staff sign-in](docs/09-staff-sign-in.md) | Account activation, sessions, staff roles, configuration, and authentication checks |
| [Firebase setup](docs/08-firebase-setup.md) | Cloud resources, local emulator commands, rules verification, and remaining activation work |
| [Implementation status](docs/07-implementation-status.md) | What works now, setup, validation, limitations, and the next slice |
| [Requirements](docs/01-requirements.md) | Confirmed scope, roles, business workflows, and decisions still needed |
| [Source audit and reuse map](docs/02-source-audit.md) | What comes from each existing project, what changes, and what needs new implementation |
| [Architecture](docs/03-architecture.md) | Recommended stack, application boundaries, authorization, payments, inventory, and operations |
| [Data model and workflows](docs/04-data-and-workflows.md) | Records, relationships, state transitions, signing, and financial rules |
| [Design direction](docs/05-design.md) | Mobile website, landing page, dashboard, and accessibility requirements |
| [Build checklist](docs/06-build-checklist.md) | Dependency-ordered implementation tasks and acceptance criteria |

## Direction

Build one modular Next.js application with shared business services for the website, customer portal, dashboard, and event point of sale. Retain Firebase and Stripe familiarity while replacing sensitive legacy mutation logic. Keep one source of truth for artwork, products, stock, orders, agreements, and money.

Use the freelancing project for business workflow and UI references; use the ecommerce template for shopping and fulfillment references. An artwork is separate from a product: a painting can appear in a portfolio, become several prints or merchandise variants, and participate in multiple commissions, exhibitions, and licenses.

The website introduces the art first, the latest collection second, and appearances and collaborations afterward. Both public and administrative experiences start with small screens. Sadboi is the first and only business in this installation; configurable branding and business-scoped records leave room for a reusable artist template later.

There is no deadline-driven reduction in scope. Checklist phases express dependencies, not postponed commitments. Staff authentication, shared artwork/assets, inventory, supplier purchasing, production records, financial foundations, and public order requests are implemented to the scope described in their feature guides. Larger checklist groups remain open until their complete workflows and validation are finished. See [implementation status](docs/07-implementation-status.md) for the current sequence and known limits.

## Planning status

- [x] Record the user's numbered answers and corrected project location.
- [x] Inspect both local source trees and selected critical implementations.
- [x] Review public portfolio/catalog references and current official framework/payment documentation.
- [x] Define reuse, adaptations, new modules, design direction, architecture, and acceptance checks.
- [ ] Implement and validate the platform using the build checklist.

The source audit is static inspection, not a claim that either source project or the future platform has passed integration tests.
