import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { requireStaff } from "@/server/staff";

export const metadata: Metadata = { title: "How-to | Sadboi Studio" };

const topics = [
  ["gallery", "Publish artwork to the gallery"],
  ["products", "Create products & variants"],
  ["editing", "Edit or archive"],
  ["workspace", "Manage staff access"],
  ["contacts", "Manage contacts"],
  ["stock", "Set up & count stock"],
  ["purchasing", "Order from a supplier"],
  ["quotes", "Compare printer quotes"],
  ["proofs", "Hand off files & approve proofs"],
  ["batches", "Track production batches"],
  ["bills", "Record vendor bills"],
  ["journal", "Post balanced journals"],
  ["payments", "Record payment attempts"],
  ["reservations", "Reserve and allocate stock"],
  ["catalog", "Publish the public catalog"],
  ["store-orders", "Review shop order requests"],
  ["production", "Track supplier production"],
  ["deliveries", "Inspect & receive deliveries"],
  ["examples", "Everyday examples"],
] as const;

export default async function Page() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  return (
    <>
      <PageHeading
        eyebrow="STUDIO / HOW-TO"
        title="A guide to studio operations."
        description="From an original artwork to a product, a supplier order, and stock on your shelves."
      />
      <p className="notice">
        Super admins can create and update these records. Accounting can view
        inventory, suppliers, orders, costs, and history; artwork setup and
        editing require a super admin.
      </p>
      <nav className="howto-topics" aria-label="Tutorial topics" id="topics">
        {topics.map(([id, title]) => (
          <Link key={id} href={"#" + id}>
            {title}
            <span aria-hidden="true"> â†’</span>
          </Link>
        ))}
      </nav>
      <div className="howto-content">
        <section
          className="howto-section"
          id="gallery"
          aria-labelledby="gallery-title"
        >
          <p className="eyebrow">ARTWORK / PUBLIC GALLERY</p>
          <h2 id="gallery-title">Put a piece on display</h2>
          <p>
            The gallery is the public body of work, including pieces that are
            not for sale. Publishing is available to super admins. Start with a
            saved artwork, a completed image upload, and permission to display
            the work.
          </p>
          <ol>
            <li>
              Open <strong>Artwork</strong>, select a piece or choose{" "}
              <strong>Add artwork</strong>, and enter its title, year, medium,
              series, story, and tags. Keep private information in{" "}
              <strong>Internal notes</strong>.
            </li>
            <li>
              Set <strong>Workspace status</strong> to{" "}
              <strong>Ready for review</strong>, resolve the{" "}
              <strong>Rights classification</strong>, and choose{" "}
              <strong>Save artwork</strong>. This does not publish it.
            </li>
            <li>
              Under <strong>Originals &amp; previews</strong>, choose a file
              with <strong>Add an artwork image</strong>, then choose{" "}
              <strong>Upload image</strong>. Wait for completion. Originals
              remain private.
            </li>
            <li>
              Under <strong>Public gallery</strong>, choose the{" "}
              <strong>Gallery image</strong>. Write an{" "}
              <strong>Image description (alt text)</strong> describing what is
              visible. Add an optional caption and public credits.
            </li>
            <li>
              Set <strong>Display order</strong> if needed: lower numbers appear
              first, with ties sorted by newest year, title, then record.
              Confirm the public-display permission checkbox.
            </li>
            <li>
              Choose <strong>Publish to gallery</strong>, then{" "}
              <strong>View public artwork</strong> to review it. Visitors can
              find it through Gallery or Explore the art on the homepage.
            </li>
          </ol>
          <aside className="howto-example">
            <strong>Example: a piece with no prints</strong>
            <p>
              Create a fictional artwork titled “Night Visitor,” save it as
              Ready for review with Artist owned rights, upload its image, and
              publish it with a visual description. It appears in the gallery
              without requiring a product, price, or stock. These are example
              details, not live business records.
            </p>
          </aside>
          <p>
            <strong>Connections:</strong> public products linked to this artwork
            appear under From this work. Publishing does not change prices,
            stock, orders, or sales. Sold-out products do not remove the
            artwork. The gallery shares a web-sized display image, never an
            original download.
          </p>
          <p>
            <strong>Changes and recovery:</strong> save artwork edits first,
            then choose <strong>Update gallery</strong> to publish those saved
            details. New uploads do not replace the selected public image
            automatically. <strong>Unpublish</strong> removes the piece and its
            gallery image endpoint while keeping the studio record. Saving
            Draft, Archived, or Needs review also removes it; restoring Ready
            does not republish it. If a save is uncertain, keep your choices and
            retry. If someone else changed the record, open the latest saved
            version before reconciling your edits.
          </p>
          <p>
            <strong>Limits:</strong> one display image per artwork; publication
            is manual. The original public URL stays the same after a title
            change. An image already downloaded by a visitor cannot be recalled.
            Private originals, private previews, and studio notes still require
            staff access. Search covers title, series, and tags, with separate
            series and medium filters. Scheduled publishing and multi-image
            stories are not included yet.
          </p>
          <Link className="button secondary" href="/admin/artworks">
            Open Artwork
          </Link>
        </section>
        <section
          className="howto-section"
          id="workspace"
          aria-labelledby="workspace-title"
        >
          <p className="eyebrow">01 / WORKSPACE ACCESS</p>
          <h2 id="workspace-title">Invite and manage staff</h2>
          <p>
            Workspace is available to super admins. Use it to give a legal or
            accounting teammate the minimum role they need, review current
            memberships, and remove access when work ends.
          </p>
          <ol>
            <li>
              Open Workspace from the staff navigation and choose{" "}
              <strong>Create invitation</strong>.
            </li>
            <li>
              Enter the personâ€™s email, choose <strong>Accounting</strong> or{" "}
              <strong>Legal</strong>, and add an optional note. Choose{" "}
              <strong>Create invitation</strong>.
            </li>
            <li>
              Share the sign-in instructions with the person through your normal
              communication channel. The platform records the invitation but
              does not send email from this screen.
            </li>
            <li>
              The person creates their own account, verifies the same email, and
              signs in. The pending invitation becomes an active membership.
              Until then, it grants no access.
            </li>
            <li>
              For a pending invitation, use <strong>Record resend</strong> after
              sending the instructions again, or{" "}
              <strong>Revoke invitation</strong> if it should no longer be used.
            </li>
            <li>
              For an active membership, choose{" "}
              <strong>Revoke membership</strong> and provide a reason. Existing
              sessions are invalidated. If the person returns, choose{" "}
              <strong>Reactivate membership</strong>; this keeps the same role
              and user history.
            </li>
          </ol>
          <aside
            className="howto-example"
            aria-label="Workspace access example"
          >
            <strong>Example: temporary accounting access</strong>
            <p>
              Invite accounting@example.com as Accounting with the note
              â€œReview Q4 supplier bills.â€ After the person verifies their
              email and signs in, they can view purchasing and inventory costs
              but cannot edit products, orders, artwork, or staff access. Revoke
              the membership when the review ends; reactivate it later if the
              same person returns.
            </p>
          </aside>
          <p>
            Super-admin memberships are provisioned through the approved
            bootstrap/deployment process and cannot be revoked from this page.
            Every invitation and membership action is revision-checked and
            recorded with the acting user, reason, and time. If a record changed
            while you were editing, refresh Workspace before trying again. If a
            save is uncertain, keep the form open and retry the same entry;
            after reloading, check the directory and audit history before
            repeating it.
          </p>
          <p>
            Do not invite a shared mailbox or assign a broader role to solve a
            temporary need. Invitations are limited to 100 records until the
            directory gains pagination. The platform does not send invitation
            email, manage password resets, or grant legal/accounting access
            before email verification.
          </p>
          <Link className="button secondary" href="/admin/settings">
            Open Workspace
          </Link>
        </section>

        <section
          className="howto-section"
          id="contacts"
          aria-labelledby="contacts-title"
        >
          <p className="eyebrow">02 / RELATIONSHIPS</p>
          <h2 id="contacts-title">
            Keep people and organizations connected to the work
          </h2>
          <p>
            Use Contacts for the people and organizations around the studio:
            printers, suppliers, galleries, collectors, commission clients,
            licensees, patrons, and collaborators. A contact is an internal
            relationship record; it does not send email or create an invoice.
          </p>
          <ol>
            <li>
              Open <strong>Contacts</strong> and choose{" "}
              <strong>Add contact</strong>. Choose <strong>Person</strong> for
              an individual or <strong>Organization</strong> for a company,
              gallery, print shop, or other group.
            </li>
            <li>
              Enter the name and any useful email, phone, or website
              information. For a person, optionally select their active
              organization.
            </li>
            <li>
              Add up to three relationship labels, such as Printer â€” Primary
              shop, Gallery â€” Booth contact, or Client â€” Commission inquiry.
              The same record can have more than one relationship.
            </li>
            <li>
              Add internal notes, an optional next follow-up date, and a
              follow-up note. Choose <strong>Save contact</strong>.
            </li>
            <li>
              Search by name, email, organization, or relationship. Use the
              People/Organizations filter to narrow the directory. Choose{" "}
              <strong>Edit contact</strong> to update details or change Status
              to <strong>Archived</strong> when the relationship is no longer
              active.
            </li>
          </ol>
          <aside className="howto-example" aria-label="Contact example">
            <strong>Example: a gallery relationship</strong>
            <p>
              Create an Organization named North Loop Gallery, then create a
              Person named Maya Chen with North Loop Gallery selected. Give Maya
              the relationships Gallery â€” Booth contact and Collaborator â€”
              Fall show. Add a follow-up date for the application deadline. The
              purchasing supplier directory remains the source for supplier
              order details; Contacts gives you the broader relationship
              context.
            </p>
          </aside>
          <p>
            Super admins can create and edit records. Legal and accounting can
            read the directory according to their staff access but cannot change
            it. Contacts are not automatically connected to purchase orders,
            artwork rights, invoices, or commissions yet; those links will be
            added as their workflows are built. If a save is uncertain, keep the
            form open and retry the same entry. If the record changed, refresh
            Contacts before editing.
          </p>
          <Link className="button secondary" href="/admin/contacts">
            Open contacts
          </Link>
        </section>

        <section
          className="howto-section"
          id="products"
          aria-labelledby="products-title"
        >
          <p className="eyebrow">01 / CATALOG SETUP</p>
          <h2 id="products-title">Create a product and its variants</h2>
          <p>
            <strong>Artwork</strong> is the original creative work. A{" "}
            <strong>product</strong> is an item based on it, such as an art
            print or T-shirt. A <strong>variant</strong> (sometimes called a
            variation) is one purchasable combination you price and count
            separately. Keep related sizes, colors, frames, and finishes under
            the same product; each combination gets its own <strong>SKU</strong>
            , price, and stock record.
          </p>
          <aside className="howto-example" aria-label="Catalog example">
            <strong>Example: Midnight Garden</strong>
            <p>
              One artwork can have an Art Print product with A3 matte and A4
              matte variants, plus a separate T-shirt product with its own size
              and color variants. Even a product with only one version needs one
              variant.
            </p>
          </aside>
          <ol>
            <li>
              <strong>Start with an artwork.</strong> Add the original work in
              Artwork, or use an existing record.
            </li>
            <li>
              <strong>Create the product.</strong> In Inventory â†’ Products
              &amp; variants, choose <strong>Add product</strong>. Select its
              original artwork, enter a product title, category, and
              description, then save with Status set to Active.
            </li>
            <li>
              <strong>Add its first variant.</strong> Choose{" "}
              <strong>Add first variant</strong> after saving, or{" "}
              <strong>Add variant</strong> on the product card. Enter a unique
              SKU such as SB-MG-PRINT-A3, a variant name, and the relevant size,
              color, material, or finish. For example, an apparel product can
              have Small/Black and Medium/Black variants, while a print product
              can have A3/Unframed and A3/Black Frame variants. Each combination
              receives its own retail price and USD stock record.
            </li>
            <li>
              <strong>Choose fulfillment and save.</strong> Use Stocked for
              units you keep in inventory. Made to order currently describes the
              variant; it does not schedule production or manage production
              capacity.
            </li>
            <li>
              <strong>Repeat for each version.</strong> Give each separately
              priced or counted version its own SKU. Choose{" "}
              <strong>Record stock</strong> after saving to begin tracking units
              by location.
            </li>
          </ol>
          <p>
            Creating a product or variant does not add stock. This is the studio
            catalog. Publish both the product and its variants to make them
            available for order requests in the public shop.
          </p>
          <div className="inv-actions">
            {staff.role === "super_admin" && (
              <Link className="button secondary" href="/admin/artworks">
                Open artwork
              </Link>
            )}
            <Link className="button secondary" href="/admin/inventory">
              Open inventory
            </Link>
          </div>
        </section>

        <section
          className="howto-section"
          id="editing"
          aria-labelledby="editing-title"
        >
          <p className="eyebrow">02 / CATALOG MAINTENANCE</p>
          <h2 id="editing-title">Edit or retire an item</h2>
          <ul>
            <li>
              <strong>Edit a product:</strong> under Products &amp; variants,
              choose <strong>Edit product</strong> to change its title,
              category, description, or status. Its original artwork link is
              permanent.
            </li>
            <li>
              <strong>Edit a variant:</strong> choose <strong>Edit</strong>{" "}
              beside the variant to change its name, attributes, retail price,
              fulfillment, or status. Its parent product and SKU are permanent.
              For a different SKU or product association, create a new variant
              and retire the old one.
            </li>
            <li>
              <strong>Retire instead of delete:</strong> open the product or
              variant editor, change Status to <strong>Archived</strong>, and
              save. Stock and history stay recorded. Archiving does not remove
              physical units from your shelves.
            </li>
            <li>
              <strong>Correct quantities:</strong> use the stock workflow below.
              Product and variant editors describe the item; stock is recorded
              separately at each location.
            </li>
          </ul>
          <p>
            Changes to the catalog do not rewrite the saved details on a placed
            purchase order.
          </p>
        </section>

        <section
          className="howto-section"
          id="stock"
          aria-labelledby="stock-title"
        >
          <p className="eyebrow">03 / PHYSICAL INVENTORY</p>
          <h2 id="stock-title">Set up stock or change a count</h2>
          <ol>
            <li>
              In Inventory â†’ <strong>Locations</strong>, choose{" "}
              <strong>Add location</strong> for your studio, gallery, or event.
            </li>
            <li>
              Open a variant with <strong>View stock</strong>, or choose it
              under <strong>Stock &amp; transfers</strong>.
            </li>
            <li>
              For an opening count or stocktake, open{" "}
              <strong>Counts &amp; low-stock thresholds</strong>, choose the
              location, and use <strong>Count physical stock</strong>. Enter the
              actual total physically there, including quarantined or committed
              units, but excluding units still in transit.
            </li>
            <li>
              Review the difference, add a reason/reference, confirm your
              review, and choose <strong>Record counted total</strong>. If the
              balance has changed, refresh stock and choose{" "}
              <strong>Start a fresh count</strong> before recounting.
            </li>
          </ol>
          <p>
            For a known difference, use the movement action{" "}
            <strong>Correct a stock count</strong>: enter âˆ’3 to remove three
            units or +5 to add five. If the saved count is 20 and you physically
            have 17, enter 17 in the actual-count form or âˆ’3 in the correction
            form. Use only one of these methods for the same correction.
          </p>
          <p>
            <strong>Physical stock</strong> is what you hold.{" "}
            <strong>Available stock</strong> subtracts reserved, allocated, and
            unavailable units. A count preserves those quantities and cannot
            reduce the total below them.
          </p>
          <p>
            Use <strong>Receive accepted stock</strong> for receipts without a
            purchase order. For deliveries on a purchase order, record them in
            Purchasing; that updates inventory automatically. Do not receive the
            same units in both places.
          </p>
        </section>

        <section
          className="howto-section"
          id="purchasing"
          aria-labelledby="purchasing-title"
        >
          <p className="eyebrow">04 / SUPPLIER ORDERS</p>
          <h2 id="purchasing-title">Order a print run or other stock</h2>
          <p>
            Purchasing connects an existing inventory SKU to a supplier, an
            agreed order, and inspected deliveries. Creating or placing an order
            does not increase stock; recording a delivery does.
          </p>
          <ol>
            <li>
              <strong>Add the supplier.</strong> In Purchasing â†’{" "}
              <strong>Suppliers</strong>, choose <strong>Add supplier</strong>.
              Record the print shop, contact details, capabilities, typical lead
              time, and useful notes. Purchasing notes are visible to
              accounting.
            </li>
            <li>
              <strong>Create a draft.</strong> In{" "}
              <strong>Purchase orders</strong>, choose{" "}
              <strong>Create purchase order</strong>. Select an active supplier
              and existing active SKUs. Add quantities, agreed unit costs in
              USD, and specifications such as paper, finish, trim, and
              packaging. Add an expected date and supplier reference if
              available.
            </li>
            <li>
              <strong>Review the agreement.</strong> Choose{" "}
              <strong>Save draft order</strong>, then{" "}
              <strong>Review order</strong>. Use <strong>Edit draft</strong>{" "}
              while details are still being agreed. Unit cost is what you pay
              the supplier; it is separate from the variantâ€™s retail price.
            </li>
            <li>
              <strong>Confirm outside the app.</strong> Place the order with the
              supplier by your usual email, phone, or ordering system. Enter the
              confirmation/reason, tick the review checkbox, then choose{" "}
              <strong>Record order placed</strong>. This freezes the reviewed
              quantities, costs, and specifications.
            </li>
          </ol>
          <p>
            The app tracks your agreement internally. It does not contact the
            supplier, send payment, or approve proof files. The production
            subtotal is the original ordered amount and excludes freight, tax,
            supplier bills, and accounting entries.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open purchasing
          </Link>
        </section>

        <section
          className="howto-section"
          id="quotes"
          aria-labelledby="quotes-title"
        >
          <p className="eyebrow">05 / PRINTER QUOTES</p>
          <h2 id="quotes-title">Compare printer quotes before ordering</h2>
          <p>
            Use Quotes in Purchasing to keep supplier estimates beside the exact
            SKU and run size. The comparison includes setup and shipping so a
            low advertised unit price does not hide a higher total.
          </p>
          <ol>
            <li>
              Open Purchasing â†’ <strong>Quotes</strong> and choose{" "}
              <strong>Add quote</strong>.
            </li>
            <li>
              Select an active supplier and variant, enter the quoted quantity,
              unit price, setup charge, shipping, expected date, expiry, and the
              agreed print specification. Save it as Received while you are
              comparing options.
            </li>
            <li>
              Compare <strong>Estimated total</strong> and{" "}
              <strong>Effective unit cost</strong>. The total is quantity Ã—
              unit cost + setup + shipping; effective unit cost divides that
              total by the quoted quantity and rounds up to a cent.
            </li>
            <li>
              After choosing a supplier, edit that quote and set Status to{" "}
              <strong>Accepted</strong>. Create a purchase-order draft and
              select the accepted quote. The server checks that the supplier and
              quoted SKU are present, then preserves the quote reference, total,
              effective unit cost, and specification on the draft.
            </li>
            <li>
              When a quote is no longer usable, set it to Rejected or Expired.
              Editing is revision-checked, so refresh before retrying if another
              teammate changed it.
            </li>
          </ol>
          <aside
            className="howto-example"
            aria-label="Quote comparison example"
          >
            <strong>Example: 100 A3 prints</strong>
            <p>
              Shop A quotes 100 Ã— $8.00, $5 setup, and $15 shipping: $820
              total, or $8.20 effective per print. Shop B quotes $7.80 each but
              $100 setup and $40 shipping: $920 total, or $9.20 effective.
              Accept the lower total only after checking the specifications and
              expected date.
            </p>
          </aside>
          <p>
            Quotes are planning records. They do not change inventory, send the
            supplier a message, approve a proof, or create a bill. Accounting
            can view them; super admins can create and edit them. A quote list
            is capped at 500 records until pagination is added.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open purchasing quotes
          </Link>
        </section>

        <section
          className="howto-section"
          id="proofs"
          aria-labelledby="proofs-title"
        >
          <p className="eyebrow">06 / FILE HANDOFF &amp; PROOFS</p>
          <h2 id="proofs-title">Hand off a print file and approve a proof</h2>
          <p>
            Proof history lives on the purchase order and is tied to one SKU at
            a time. The source is a ready private artwork asset, so the supplier
            conversation can refer to an exact file version.
          </p>
          <ol>
            <li>
              Upload the print-ready image under the linked artwork in{" "}
              <strong>Artwork</strong>. Wait until the asset appears as a ready
              private preview.
            </li>
            <li>
              Open the purchase order and find{" "}
              <strong>Print-file handoff &amp; proofs</strong>. Choose{" "}
              <strong>Add proof update</strong>.
            </li>
            <li>
              Select the order SKU, artwork file, version number, and{" "}
              <strong>Sent to supplier</strong>. Add the handoff reference or
              production notes, then save.
            </li>
            <li>
              When the supplier returns a proof, update the same version to{" "}
              <strong>Changes requested</strong> or <strong>Approved</strong>.
              If the file changes, upload a new asset and create the next
              version.
            </li>
            <li>
              Approve only the version that matches the agreed specification.
              Approving a newer version automatically marks an older approved
              version as superseded.
            </li>
          </ol>
          <aside className="howto-example" aria-label="Proof approval example">
            <strong>Example: revised A3 file</strong>
            <p>
              Version 1 is sent to the printer, which requests a darker black.
              Upload the revised artwork as a new private asset and record
              version 2 with the change note. Set version 1 to Changes
              requested, then set version 2 to Approved after checking the
              returned proof.
            </p>
          </aside>
          <p>
            Proof updates do not place an order, receive stock, or send files to
            the supplier automatically. The current handoff is an internal
            record of which private asset and version were communicated
            externally. PDF/PSD processing, external delivery links, signatures,
            and production batches are planned next.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open purchase orders
          </Link>
        </section>

        <section
          className="howto-section"
          id="production"
          aria-labelledby="production-title"
        >
          <p className="eyebrow">05 / SUPPLIER PROGRESS</p>
          <h2 id="production-title">
            Track production and changing delivery dates
          </h2>
          <p>
            Use this after placing an order to record what the supplier tells
            you about each SKU. A super admin records updates; accounting can
            view them. Start with a placed purchase order with units still
            outstanding. In Suppliers, optionally record typical production
            capacity in units per day; the Production queue then estimates run
            duration from the outstanding quantity.
          </p>
          <ol>
            <li>
              In Purchasing, open <strong>Production</strong>. The queue shows
              outstanding SKU lines from placed and partially received orders,
              sorted by expected delivery date. Search by order, supplier, SKU,
              or reference, or filter by stage.
            </li>
            <li>
              Choose <strong>Review order &amp; production</strong>, then find{" "}
              <strong>Supplier production</strong>. Choose the{" "}
              <strong>SKU to update</strong>.
            </li>
            <li>
              Select the <strong>Latest supplier stage</strong>: Queued with
              supplier, Proof in progress, In production, Ready for collection /
              dispatch, Shipped by supplier, or On hold. This describes the
              remaining units for that SKU.
            </li>
            <li>
              Enter the <strong>Current expected delivery date</strong>, or
              leave it blank if unknown. Add the supplier update/reason and an
              optional confirmation or shipment reference, then choose{" "}
              <strong>Save production update</strong>.
            </li>
            <li>
              Review <strong>Production update history</strong> on the order.
              The latest report appears in the queue; previous reports and the
              original expected delivery date remain available.
            </li>
          </ol>
          <aside
            className="howto-example"
            aria-label="Production delay example"
          >
            <strong>Example: a print shop delay</strong>
            <p>
              You ordered 100 A3 prints for October 1. The shop reports a paper
              shortage: record On hold, an October 8 expected delivery, and the
              reason. After confirmation that printing started, add an In
              production update. If 60 prints then arrive, receive them in the
              delivery form; the Production queue now shows 40 outstanding.
              Update progress for those remaining 40 as needed.
            </p>
          </aside>
          <p>
            <strong>
              Progress updates do not receive stock or change ordered
              quantities, prices, or specifications.
            </strong>{" "}
            Shipped units remain outstanding until a delivery is recorded. Proof
            in progress is a tracking note, not an approval of any proof file.
            Communication, shipment tracking, and scheduling happen with the
            supplier outside the app.
          </p>
          <p>
            To correct a stage or date, save a new update with the reason;
            earlier updates stay in history. Stages can move backwards when the
            situation changes. If the order changed while you were editing,
            choose <strong>Refresh purchasing</strong>, review it, and enter the
            update again. If a save could not be confirmed, keep the form open
            and use <strong>Retry same entry</strong>. After closing or
            reloading the page, check history before re-entering an update.
          </p>
          <p>
            Fully delivered SKU lines leave the queue. Closing or cancelling an
            order also removes its outstanding work and prevents further
            production updates, while preserving history. Previously placed
            orders can still be tracked after archiving their supplier or
            variant. The queue is a manual progress view; it does not allocate
            production capacity, send reminders, or create replacement orders.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open purchasing
          </Link>
        </section>

        <section
          className="howto-section"
          id="deliveries"
          aria-labelledby="deliveries-title"
        >
          <p className="eyebrow">06 / RECEIVING &amp; INSPECTION</p>
          <h2 id="deliveries-title">
            Record what arrived and what passed inspection
          </h2>
          <p>
            Open the placed order using <strong>Review order</strong>. Under{" "}
            <strong>Record a delivery</strong>, choose the delivered SKU and
            receiving location. Split that delivery into these outcomes, add
            inspection notes and a delivery reference, then choose{" "}
            <strong>Record delivery &amp; update stock</strong>. Repeat for each
            delivered SKU and later shipment.
          </p>
          <div
            className="table-scroll howto-table"
            role="region"
            aria-label="Delivery outcome comparison"
            tabIndex={0}
          >
            <table>
              <caption>How delivery outcomes affect inventory</caption>
              <thead>
                <tr>
                  <th scope="col">Outcome</th>
                  <th scope="col">When to use it</th>
                  <th scope="col">Stock effect</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Accepted</th>
                  <td>Units passed inspection.</td>
                  <td>Adds physical and available stock.</td>
                </tr>
                <tr>
                  <th scope="row">Damaged / unapproved units kept</th>
                  <td>You still hold units awaiting a decision.</td>
                  <td>
                    Adds physical stock in quarantine, unavailable for sale.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Rejected units not kept</th>
                  <td>The supplier kept the units or you returned them.</td>
                  <td>Does not add physical stock.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>
              All three outcomes reduce the outstanding order quantity.
            </strong>{" "}
            Do not enter the same delivery again. Replacement units need a new
            order referencing the original.
          </p>
          <aside
            className="howto-example"
            aria-label="Partial delivery example"
          >
            <strong>Example: 100 A3 prints at $8 each</strong>
            <p>
              Your original production subtotal is $800. The first delivery
              contains 60 prints: 55 accepted, 3 damaged prints kept, and 2
              rejected prints returned. Starting from zero, inventory now holds{" "}
              <strong>
                58 physical units, 55 available units, and 3 quarantined units
              </strong>
              . The purchase order has <strong>40 units outstanding</strong>.
            </p>
            <p>
              If the supplier delivers those 40 later, record that shipment
              separately. If you agree to cancel them, use Close this order and
              give a reason; the existing delivery and stock remain recorded.
            </p>
          </aside>
          <p>
            Resolve retained damaged units in Inventory using{" "}
            <strong>Approve stock for sale</strong> or{" "}
            <strong>Discard unavailable stock</strong>, as appropriate. Those
            stock movements do not rewrite the original inspection outcome.
          </p>
          <p>
            An order becomes <strong>Received</strong> when all ordered units
            have recorded delivery outcomes, including quarantine and rejection.
            Use <strong>Cancel this draft</strong> or{" "}
            <strong>Close this order</strong> to end a commitment after
            resolving it with the supplier. Remaining units are cancelled,
            history is preserved, and the order cannot be reopened.
          </p>
        </section>

        <section
          className="howto-section"
          id="batches"
          aria-labelledby="batches-title"
        >
          <p className="eyebrow">07 / PRODUCTION RUNS</p>
          <h2 id="batches-title">Track physical production batches</h2>
          <p>
            Use batches to describe the supplier runs behind a purchase-order
            SKU. They are useful when one order is printed in multiple runs or
            when waste needs to be recorded separately from receiving
            inspection.
          </p>
          <ol>
            <li>
              Open a placed purchase order and find{" "}
              <strong>Production batches</strong>. Choose{" "}
              <strong>Add batch</strong>.
            </li>
            <li>
              Select the order SKU, enter the supplier run number, and record
              the units in the batch.
            </li>
            <li>
              Enter estimated waste or spoilage and choose Planned, In
              production, or Completed. Add paper-lot, machine, or reprint notes
              when useful.
            </li>
            <li>
              Update the batch as the run progresses. Use Cancelled when the run
              will not happen; cancelled quantities no longer count against the
              order allowance.
            </li>
            <li>
              When units arrive, still use <strong>Record a delivery</strong> to
              inspect accepted, quarantined, and rejected units. A completed
              batch does not add stock by itself.
            </li>
          </ol>
          <aside
            className="howto-example"
            aria-label="Production batch example"
          >
            <strong>Example: two runs for one order</strong>
            <p>
              An order contains 100 A3 prints. Record RUN-01 as 60 units in
              production with 2 expected waste, then RUN-02 as 40 planned units.
              After RUN-01 finishes, mark it Completed and record the shipment
              through Receiving. The order still has 40 units outstanding until
              their delivery is inspected.
            </p>
          </aside>
          <p>
            Batch quantities cannot exceed the ordered quantity for that SKU,
            and the current workspace supports up to 1,000 batch records. If a
            run needs replacement units, use{" "}
            <strong>Add reprint request</strong> under Production batches, link
            it to the original batch, and record the reason and approval status.
            Reprint units still require normal delivery inspection. Batches do
            not schedule machines, allocate capacity, or automatically revise
            delivery dates.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open production batches
          </Link>
        </section>

        <section
          className="howto-section"
          id="bills"
          aria-labelledby="bills-title"
        >
          <p className="eyebrow">08 / FINANCE REGISTER</p>
          <h2 id="bills-title">Record a vendor bill</h2>
          <p>
            Use Vendor bills when a supplier sends an invoice. Link it to the
            purchase order when possible, then record the invoice components;
            the platform calculates the total.
          </p>
          <ol>
            <li>
              Open Purchasing â†’ <strong>Vendor bills</strong> and choose{" "}
              <strong>Add vendor bill</strong>.
            </li>
            <li>
              Select the active supplier and optional purchase order, then enter
              the invoice number, dates, subtotal, shipping, and tax.
            </li>
            <li>
              Choose Received while checking the invoice, or Approved after
              review. Use Paid only when payment is confirmed outside this
              register; use Void for a cancelled invoice.
            </li>
            <li>
              Review the calculated total and notes, then save. The bill remains
              separate from receiving and inventory.
            </li>
          </ol>
          <p>
            Vendor bills currently do not initiate payment, create journal
            entries, or change stock. Accounting can view the register; super
            admins can create and edit records.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open vendor bills
          </Link>
        </section>

        <section
          className="howto-section"
          id="journal"
          aria-labelledby="journal-title"
        >
          <p className="eyebrow">09 / DOUBLE-ENTRY ACCOUNTING</p>
          <h2 id="journal-title">Post a balanced journal entry</h2>
          <p>
            Use Journal after reviewing a vendor bill. The starter flow posts
            the bill total as a debit to Inventory and a credit to Accounts
            payable.
          </p>
          <ol>
            <li>
              Open Purchasing â†’ <strong>Journal</strong> and choose{" "}
              <strong>Post journal entry</strong>.
            </li>
            <li>
              Choose a non-void vendor bill, enter the entry date and memo, and
              confirm the debit and credit accounts.
            </li>
            <li>
              Enter one amount. The platform creates equal debit and credit
              lines and rejects duplicate postings for the same bill.
            </li>
            <li>
              Review the journal history. Posting does not mark a bill paid,
              initiate payment, or change stock.
            </li>
          </ol>
          <p>
            Reversals, account configuration, period locks, payment attempts,
            and reconciliation are not part of this first ledger slice.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open journal
          </Link>
        </section>

        <section
          className="howto-section"
          id="payments"
          aria-labelledby="payments-title"
        >
          <p className="eyebrow">10 / PAYMENT REGISTER</p>
          <h2 id="payments-title">Record a payment attempt or settlement</h2>
          <p>
            Use Payments after an external bank, card, cash, or other payment
            action. The register keeps attempts separate from the vendor bill
            and journal.
          </p>
          <ol>
            <li>
              Open Purchasing â†’ <strong>Payments</strong> and choose{" "}
              <strong>Record payment</strong>.
            </li>
            <li>
              Choose a received or approved vendor bill, enter the amount,
              method, date, and external reference.
            </li>
            <li>
              Choose Attempted while awaiting confirmation, Settled after
              confirmation, Failed when the provider rejects it, or Void when
              the record should no longer count.
            </li>
            <li>
              Review payment history. Settled records cannot exceed the bill
              total.
            </li>
          </ol>
          <p>
            The platform does not move money or create journal entries from this
            screen. Settled payments can be allocated across bills through the
            financial controls API, and settled refunds cannot exceed the
            original payment. Period locks prevent new dated financial records
            from being added to a closed month.
          </p>
          <Link className="button secondary" href="/admin/purchasing">
            Open payments
          </Link>
        </section>

        <section
          className="howto-section"
          id="reservations"
          aria-labelledby="reservations-title"
        >
          <p className="eyebrow">11 / STOCK COMMITMENTS</p>
          <h2 id="reservations-title">Reserve or allocate stock</h2>
          <p>
            Use Inventory â†’ Reservations when units need to be held for a
            commission, event, wholesale request, or internal purpose.
            Reservations are location-specific and protect available stock.
          </p>
          <ol>
            <li>
              Choose <strong>Add reservation</strong>, then select the SKU and
              physical location.
            </li>
            <li>
              Choose the purpose, enter a reference, and record the quantity.
              Use Reserved for a hold or Allocated when the units are assigned
              to a confirmed commitment.
            </li>
            <li>
              When the commitment ends, edit the record to Released. When the
              units have been used or handed over, choose Fulfilled.
            </li>
            <li>
              Refresh stock to see the reserved or allocated quantities
              reflected in Available.
            </li>
          </ol>
          <p>
            Reservations do not change On hand. The server checks the current
            balance in a transaction and rejects changes that would promise more
            units than are available. Receiving and physical counts remain
            separate workflows.
          </p>
          <Link className="button secondary" href="/admin/inventory">
            Open reservations
          </Link>
        </section>

        <section
          className="howto-section"
          id="catalog"
          aria-labelledby="catalog-title"
        >
          <p className="eyebrow">12 / PUBLIC CATALOG</p>
          <h2 id="catalog-title">Publish products and variants</h2>
          <p>
            Publication is controlled separately from the internal
            Active/Archived status. Use Private while preparing a record, then
            choose Public catalog only when its description, price, fulfillment
            method, and stock behavior are ready.
          </p>
          <ol>
            <li>
              Open Inventory â†’ Products &amp; variants and edit the product or
              variant.
            </li>
            <li>
              Set Status to Active and Publication to{" "}
              <strong>Public catalog</strong>, then save.
            </li>
            <li>
              Open <strong>/shop</strong> to review the public listing. Stocked
              variants show available online units; made-to-order variants show
              their fulfillment mode.
            </li>
            <li>
              Set Publication back to Private when a product should disappear
              without archiving its internal history.
            </li>
          </ol>
          <p>
            The public page does not expose private artwork notes, archived
            records, reserved units, or internal costs. Publishing does not
            create an order or consume inventory.
          </p>
          <Link className="button secondary" href="/shop">
            Open public catalog
          </Link>
        </section>

        <section
          className="howto-section"
          id="store-orders"
          aria-labelledby="store-orders-title"
        >
          <p className="eyebrow">SHOP / ORDER REQUESTS</p>
          <h2 id="store-orders-title">Request an order and recover a retry</h2>
          <p>
            Customers can request published products without a staff account.
            Super admins and accounting can review requests in Orders. Before
            offering a stocked variant, publish its parent product and variant
            and record available stock at an active online location.
          </p>
          <ol>
            <li>
              Open Shop, choose View Details, choose whole quantities, then
              choose Add selected to cart. Open Cart to review the item
              subtotal. Remove a line before submitting if it is no longer
              wanted.
            </li>
            <li>
              Enter Your Name and Email. Choose Studio pickup or Ship to me
              under Fulfillment. Shipping requires a US address. Choose Request
              order once.
            </li>
            <li>
              Wait for Order received and save the order number. The request
              awaits payment; this step does not charge the customer or send an
              automatic email.
            </li>
            <li>
              If confirmation is interrupted, choose Retry order request. The
              original details stay locked until the result is known, so
              retrying returns the same order number. A pending request can be
              recovered after reloading the same tab when browser storage is
              available.
            </li>
            <li>
              Open Orders to review the request. Customers should contact the
              studio with their order number for changes after submission;
              self-service changes and cancellation are not available yet.
            </li>
          </ol>
          <p>
            Example (fictional): two $25 prints and one $30 print produce an $80
            item subtotal. Three stocked units become allocated while physical
            stock remains unchanged. Merely adding them to the cart holds
            nothing. Shipping and taxes are not calculated by this request form.
          </p>
          <p>
            If availability or publication has changed, a rejected request
            leaves the stock and order counter unchanged. Correct the selection
            and retry. Saved carts refresh their prices and available quantities
            from the catalog. If browser storage is blocked, keep the tab open
            until confirmation; after closing it with an uncertain result, ask
            the studio to check Orders before submitting again.
          </p>
          <p>
            Made-to-order lines do not allocate physical stock or schedule
            production. Payment collection, automated follow-up, reservation
            expiry, and shipping rates still require further work.
          </p>
          <div className="inv-actions">
            <Link className="button secondary" href="/admin/orders">
              Open Orders
            </Link>
            <Link className="button secondary" href="/shop">
              Open Shop
            </Link>
          </div>
        </section>

        <section
          className="howto-section"
          id="examples"
          aria-labelledby="examples-title"
        >
          <p className="eyebrow">07 / EVERYDAY USE</p>
          <h2 id="examples-title">How the pieces work together</h2>
          <h3>Replenish a popular print</h3>
          <p>
            Set a low-stock threshold and target for its SKU at the studio under
            Counts &amp; low-stock thresholds. When available stock reaches or
            falls below the threshold, it appears in <strong>Low stock</strong>.
            Review open purchase orders and incoming transfers before ordering:
            suggestions do not subtract those incoming units. Create a purchase
            order for the quantity you decide to buy, then receive it in
            Purchasing. Refresh Low stock to see the updated availability.
          </p>
          <h3>Prepare for a convention</h3>
          <p>
            Order the print run, receive and inspect it at the studio, then use{" "}
            <strong>Dispatch a transfer</strong> in Inventory to move accepted
            units to the event location. Dispatch removes them from the source;
            they stay in transit until you record the destinationâ€™s transfer
            outcome.
          </p>
          <h3>Review a supplier before the next run</h3>
          <p>
            Search purchase orders by supplier, order number, reference, or
            status. Open past orders to review the agreed costs and
            specifications alongside accepted, quarantined, and rejected
            quantities. Accounting can view the same records when reviewing the
            supplier account.
          </p>
          <Link className="inline-link" href="#topics">
            Back to tutorial topics â†‘
          </Link>
        </section>
      </div>
    </>
  );
}
