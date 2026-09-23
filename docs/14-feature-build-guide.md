# Feature build guide

Every user-facing feature ships with a how-to inside the platform. This applies to every phase of the [build checklist](06-build-checklist.md), not just inventory and purchasing. Extend the tutorial whenever its workflow changes.

## Build sequence

1. Choose a coherent workflow and check its dependencies, existing conventions, role scope, and current implementation.
2. Define the user outcome, connected record effects, validation, retry/recovery behavior, and concrete acceptance examples.
3. Implement the domain rules, server authorization/transactions, and responsive UI together. Keep historical commitments and physical/financial effects explicit.
4. Add or update the relevant in-app tutorial using the structure below. Add a contextual link from the feature screen and a discoverable entry in How-to.
5. Verify instructions against real labels and behavior. Run checks appropriate to the change; use emulator data for mutation tests. Run `pnpm check` and emulator integration suites sequentially because Next route type generation is shared.
6. Record results, scope limits, and outstanding browser verification. Update implementation notes and the checklist without marking a partially implemented task group complete.

## Required tutorial content

- **Purpose:** what the feature helps the user accomplish and when to use it.
- **Before starting:** needed records, setup, permissions, and external steps.
- **Steps:** exact page, tab, field, and button names in the normal workflow.
- **Example:** realistic values and their expected result; distinguish fictional example data from business records.
- **Connections:** what changes in inventory, commitments, customer records, payments, or other modules; distinguish saved plans from actual effects.
- **Changes and recovery:** how to edit, cancel/archive, correct a mistake, handle stale data, and recover from an uncertain save when applicable.
- **Limits:** relevant manual steps and missing capabilities, without exposing implementation details in the user flow.

Use plain language and match the platform's terminology. Define unfamiliar terms such as SKU. Prefer short ordered steps, examples, and comparison tables. Use section anchors so help links land at the relevant task. Respect reduced motion, keyboard navigation, narrow screens, and readable text sizes.

## Current help area

`web-app/src/app/admin/how-to/page.tsx` hosts the initial staff guide. The staff navigation and contextual links in Inventory/Purchasing lead there. Super admins and accounting can read it; editing instructions identify the required role. Future legal/customer features need help that their roles can actually access, without linking them to restricted screens.

Implemented tutorials cover Workspace access, contacts/organizations, catalog setup/maintenance, counts, purchasing/receiving, supplier production progress and recovery, and examples of replenishment and transfers. Existing sign-in and artwork/private uploads capabilities need fuller dedicated tutorials; their short UI hints do not satisfy this requirement for complete feature documentation.

Documentation describes implemented behavior. It must not promise future storefront publication, proof approval, notifications, accounting, or automatic production scheduling as if those features exist.
