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
  ["public-inquiries", "Review public inquiries"],
  ["commissions", "Manage commission inquiries and projects"],
  ["proposals", "Prepare estimates and proposals"],
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
  ["fulfillment", "Pack, ship, collect, or cancel an order"],
  ["store-payments", "Review shop payment events"],
  ["order-emails", "Review order emails"],
  ["shipping-rates", "Set shipping rates and review totals"],
  ["returns-refunds", "Receive returns and issue test refunds"],
  ["shipment-cases", "Resolve damaged or lost shipments"],
  ["payment-disputes", "Review payment disputes"],
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
        <section className="howto-section" id="public-inquiries" aria-labelledby="public-inquiries-title">
          <h2 id="public-inquiries-title">Review public inquiries</h2>
          <p>Visitors use the public <Link href="/contact">Contact</Link> form to choose a purpose and send a message. Super admins and accounting can read the private inbox; only super admins change statuses.</p>
          <ol><li>Open <Link href="/admin/inquiries">Inquiries</Link> and filter by New, Reviewing, Replied, Closed, or Spam.</li><li>Use the purpose label and message to decide where the request belongs. The form does not create a Contact, project, order, agreement, or payment automatically.</li><li>Add a private update note, then set the status. Use Replied only after you have responded through your chosen channel. The platform does not send email from this inbox.</li></ol>
          <p><strong>What visitors see:</strong> a short guide explains commission, shop/order, wholesale/stockist, press/collaboration, and general questions. They provide name, email, subject, message, and optional reference. A consent checkbox and hidden honeypot reduce accidental or automated submissions. Do not request passwords or payment details through the form.</p>
          <p><strong>Inbox actions:</strong> click a table row to open its full message and review dialog. Leave it New when it still needs attention, use Mark read to move it to Reviewing, and add a private note when context should stay with the record. Archive removes it from the active table; Show archived and Restore bring it back. The row icons provide Archive, Mark read, and Spam and archive shortcuts. Spam is archived automatically.</p>
          <p><strong>Limits and recovery:</strong> Messages are capped at 4,000 characters and the inbox at 10,000 records. Duplicate retries return the original result; conflicting request IDs are rejected. Reload the inbox before updating a stale row. Archived/closed business records are not changed by public submissions.</p>
        </section>
        <section className="howto-section" id="proposals" aria-labelledby="proposals-title">
          <h2 id="proposals-title">Prepare estimates and proposals</h2>
          <p>Use a proposal to set the client-facing scope, price, timing and revision allowance before an agreement or deposit. Start with a saved inquiry or project and an active contact. Super admins prepare and record responses; accounting can read and print. Converted inquiries and their projects share one proposal series.</p>
          <ol>
            <li>In <Link href="/admin/projects">Projects</Link>, open the saved inquiry or project and choose <strong>Estimates and proposals</strong>. Review the copied title, scope and deliverables for the client; private notes are not copied. Enter Timing and dependencies, Included revisions and extra-work policy, and Valid through (UTC).</li>
            <li>Enter item descriptions, whole-number quantities and USD unit prices. Use <strong>Add price item</strong> for more lines. Enter Discount and Tax amount, using zero for none. Choose Tax treatment and explain it in Tax explanation for client. Not calculated can be saved as an estimate but cannot be issued. Tax is entered manually; the app does not decide whether tax applies.</li>
            <li>Add a Private change note and choose <strong>Save estimate draft</strong>. Review the calculated totals and document below. Save any corrections, then enter an Action note and choose <strong>Issue saved proposal</strong>. This assigns a proposal number and freezes that version. Unsaved form edits are not issued.</li>
            <li>Use <strong>Print / save PDF</strong> to print only the displayed proposal document, then share the file yourself. Turn off browser headers and footers to omit the private page URL. No email or public link is created. Preview version lets you inspect an earlier offer; older versions are marked Superseded.</li>
            <li>After receiving a response elsewhere, enter an Action note and Client response evidence/reference identifying who replied, when, and where their response is retained. Choose <strong>Record client acceptance</strong> or <strong>Record client decline</strong>. Acceptance requires a still-valid issued proposal and is read-only afterward. It is a staff record of the response, not an electronic signature.</li>
          </ol>
          <p><strong>Fictional example:</strong> two illustration items at $300 each, a $50 discount and $0 tax produce a $550 total. Resolve and explain the example’s tax treatment before issuing. State two included revision rounds and timing dependent on a later agreement/deposit. Issuing and recording acceptance create no invoice, stock reservation, payment or project-status change.</p>
          <p><strong>Changes and recovery:</strong> edit a draft freely and save. Use <strong>Create revised draft</strong> after an issued, declined or withdrawn version; the previous offer is superseded immediately, and its contents stay in Proposal history. Use <strong>Withdraw proposal</strong> to stop an issued offer. Notify the client yourself. Expired offers cannot be accepted; revise and issue again. Reload proposal discards unsaved edits and resolves stale data. After an uncertain save choose <strong>Retry same proposal action</strong>; after reopening the same tab, use <strong>Recover interrupted proposal action</strong> first. If browser storage is unavailable, check history before submitting again.</p>
          <p><strong>Limits:</strong> one series per inquiry/project, USD only, 20 price items, whole quantities, totals up to $1,000,000, 20 proposal versions and 100 saved changes. Validity includes the chosen UTC date. The client name/email comes from the commission’s saved contact snapshot. Restore archived contacts/commissions and reopen closed work before preparing offers. Accepted-proposal corrections, change orders, agreements, signatures, invoices, deposits, automated tax, delivery tracking and client portal actions remain separate work. The PDF contains the client-facing fields you entered; review them before sharing.</p>
        </section>
        <section className="howto-section" id="commissions" aria-labelledby="commissions-title">
          <h2 id="commissions-title">Manage commission inquiries and projects</h2>
          <p>Use Projects to record a client brief, decide whether the studio wants to take it on, and track internal work. Super admins manage records; accounting reads saved details and history. These private records are not a client portal.</p>
          <ol>
            <li>Add the person or organization in <Link href="/admin/contacts">Contacts</Link> first. In <Link href="/admin/projects">Projects</Link>, choose <strong>Add inquiry</strong> and select an active contact. Enter Title, Brief and Deliverables. Planning budget is optional USD; blank means unknown, while zero means a known zero budget. Desired deadline and Next follow-up are optional.</li>
            <li>Record Qualification notes and Private notes. Choose Inquiry stage: New, Reviewing, Estimating, Accepted or Declined. Add an Update note explaining the decision, then choose <strong>Save inquiry</strong>. Acceptance is the studio’s internal decision, not a signed agreement or proof of a deposit.</li>
            <li>Open a saved, active Accepted inquiry. Enter a Conversion note and choose <strong>Create project from inquiry</strong>. Save any inquiry edits first: conversion uses the saved brief. The linked contact must still be active. One inquiry creates one project; the accepted inquiry becomes read-only and remains linked to the project.</li>
            <li>Use <strong>Add milestone</strong> and <strong>Add task</strong> to plan work. Give each a title, optional due date and notes; optionally link a task to a milestone. Set task and milestone progress, add an Update note and choose <strong>Save project</strong>. All changes in that save become one history version.</li>
            <li>Set Project status to Active or On hold as work progresses. Finish or cancel open tasks before completing their milestone. Complete or skip milestones and finish or cancel tasks before marking the whole project Completed. Cancelled stops internal tracking without changing payments or orders.</li>
          </ol>
          <p><strong>Example:</strong> record a fictional album-cover inquiry with a $600 planning budget and one final cover image as the deliverable. Accept it, create its project, add a Sketch review milestone and a Prepare sketches task linked to it. Mark the task Done and the milestone Completed after internal review. No client approval, invoice, deposit or delivery is implied by these steps.</p>
          <p><strong>Changes and history:</strong> Progress and change history shows the latest 20 saved versions, including notes and previous plans; older versions stay stored. Correct an inquiry before conversion or edit its linked project afterward. Project edits retain the original Accepted inquiry snapshot. Contact names/emails are preserved at intake or reassignment and do not follow directory edits automatically. Saved tasks cannot be removed; cancel them. Skip unwanted milestones. To change completed/cancelled work, explicitly reopen it as Active, Planned or On hold and explain why.</p>
          <p><strong>Archive and recovery:</strong> Visibility → Archived hides an unconverted inquiry or project from the active list without deleting history, cancelling work or sending anything. Use Show → Archived to find it and restore Visibility → Active list. Restore an archived project before editing it. Reload saved record and Back to list discard unsaved edits. A stale revision requires reloading. After an uncertain result, keep the tab open and choose <strong>Retry same commission save</strong>. After reopening the same browser tab, choose <strong>Recover interrupted save</strong> first; recovery depends on browser storage. If storage is unavailable, check saved records before submitting a new inquiry or conversion.</p>
          <p><strong>Connections and limits:</strong> no stock reservations, artwork publication, contracts, invoices, payments, email or client approval changes occur. Staff record inquiries received elsewhere; public inquiry intake is later work. Dates do not send reminders. This slice supports 500 inquiries and 500 projects, 40 tasks and 20 milestones per project, and 200 saved versions per record. Use <Link href="#proposals">Estimates and proposals</Link> for client pricing, scope and revision allowances. Time tracking, client proof review, revision tracking and protected final delivery remain separate work.</p>
        </section>
        <section className="howto-section" id="payment-disputes" aria-labelledby="payment-disputes-title">
          <h2 id="payment-disputes-title">Review payment disputes</h2>
          <p>A payment dispute happens when a customer challenges a card charge with their bank. It is separate from a refund or shipment case. This workflow tracks the original confirmed Stripe test payment. Super admins check Stripe and save private notes; accounting can read the history.</p>
          <ol>
            <li>Open <Link href="/admin/orders">Orders</Link>, select the order and choose <strong>Load payment disputes</strong>. Choose <strong>Refresh Stripe disputes</strong> to retrieve current records. An unchecked or empty saved history does not prove there is no dispute in Stripe.</li>
            <li>Review the disputed amount, reason, status, response deadline and last check time. Stripe supplies these values. A passed deadline requires checking the available options in Stripe immediately.</li>
            <li>Choose <strong>Update private notes</strong>. Set the <strong>Response plan</strong>, record <strong>Evidence references</strong> and explain the next action in <strong>Dispute update notes</strong>. Choose <strong>Save private dispute notes</strong>. References can identify receipts, tracking, policies and customer messages in existing secure storage; they do not upload files or send a response.</li>
            <li>Open the Stripe Dashboard, select the displayed account and test mode, and find the displayed dispute ID. Submit evidence or accept the dispute there. A saved plan to accept or challenge is only an internal note. Stripe evidence saved as a draft is not necessarily submitted; check its submission status.</li>
            <li>Refresh Stripe disputes after responding and when an outcome arrives. Stripe determines Won, Lost, inquiry closure or prevention; staff notes cannot change the provider outcome. Status changes and previous notes remain in their histories.</li>
          </ol>
          <p><strong>Example:</strong> a fictional $35 test order is disputed as product not received. Record a delivery-receipt reference and plan to challenge. Submit the actual evidence in Stripe before its deadline. The app shows Under review after synchronization and later the outcome. It does not create a refund, payment, journal entry or stock movement for the dispute.</p>
          <p><strong>Connections:</strong> known open or lost disputes pause unshipped fulfillment, new replacement preparation/dispatch and new app refunds. Cancelling an unshipped order or prepared replacement still releases its existing allocation. Already-dispatched goods can still be marked delivered or have tracking corrected. Won, closed inquiries and prevented disputes remove the dispute hold after synchronization, while other payment/refund restrictions still apply. A loss does not automatically cancel or restock an order. Review chargeback funds in Stripe before considering a separate refund.</p>
          <p><strong>Recovery:</strong> Reload dispute history replaces unsaved edits. Stale notes require reloading. After an uncertain save, keep the page open and use <strong>Retry same dispute note</strong>; session storage preserves the request where available. Provider outages retain saved history and holds. Refresh again after a concurrent update. The screen shows the latest 30 status changes and 30 notes; older history is retained. Notes have a 200-update limit.</p>
          <p><strong>Limits:</strong> up to 20 disputes for an order’s original payment. Disputes on unmapped, additional or unaccepted late payments need separate Stripe/payment-history review. New disputes arrive through configured Stripe webhooks or manual refresh; the scheduler rechecks already-known open disputes. Deadlines do not send reminders. Evidence uploads, bank submission/acceptance inside this app, fees and balance accounting, customer notifications and live-mode support are later work. Staff notes and dispute details are never added to the customer’s private order page.</p>
        </section>
        <section className="howto-section" id="shipment-cases" aria-labelledby="shipment-cases-title">
          <h2 id="shipment-cases-title">Resolve damaged or lost shipments</h2>
          <p>Use a shipment case when a customer reports damage or loss after dispatch. Super admins manage cases and replacements; accounting reads their history. The original order must be a dispatched shipping order, with trustworthy fulfillment and stock records. Pickup and unshipped orders use returns or cancellation instead.</p>
          <ol>
            <li>Open <Link href="/admin/orders">Orders</Link>, select the order, and choose <strong>Load shipment case</strong>. Choose <strong>Problem</strong>, enter affected quantities, carrier/claim references and evidence references. Keep photos and messages in existing secure storage; this form stores references, not uploads. Add <strong>Case update / resolution notes</strong> and choose <strong>Save shipment case</strong> with status Open.</li>
            <li>Use Investigating while following up with the customer or carrier. Each save retains the previous details. Claim references are notes only: the platform does not submit insurance claims.</li>
            <li>For a refund, use <strong>Returns and refunds</strong> on the same order and wait for a confirmed successful refund. Record any physically received item there, with its inspected stock disposition. Then <strong>Reload shipment case</strong> to select those saved records. Lost items are not received returns and must not be restocked.</li>
            <li>For a replacement, save the affected quantities first. Verify the original address shown, choose a stock location for each stocked item, add <strong>Replacement notes</strong>, and choose <strong>Prepare replacement shipment</strong>. This reserves new sellable stock and collects no additional payment. Made-to-order items require manual production before dispatch.</li>
            <li>After packing, select replacement status Shipped, enter its own tracking number and choose <strong>Save replacement status</strong>. This consumes the reserved replacement stock once. Update tracking or mark Delivered later. Cancel a prepared replacement to release its allocation; cancellation is unavailable after dispatch.</li>
            <li>Resolve the case as Refund issued (link a confirmed refund), Replacement sent (requires dispatch), Shipment located (lost cases only), or Closed without refund or replacement. Explain the decision and any partial refund in the notes. Ship or cancel any prepared replacement before closing the case.</li>
          </ol>
          <p><strong>Example:</strong> one of three prints arrives damaged. Record one affected unit. Receiving that damaged print into quarantine adds one on-hand and one unavailable unit. Preparing its replacement allocates one separate sellable unit; shipping consumes that unit. A lost print never adds stock. Refunding $25 changes money only. Case closure changes neither money nor stock.</p>
          <p><strong>Recovery and corrections:</strong> use <strong>Retry same shipment save</strong> after an uncertain result; session storage restores it where available. Reload shipment case replaces unsaved edits with saved records. Stale saves require reload. Reopen a resolved case as Investigating with an explanatory note; previous resolutions remain in history. A prepared replacement locks affected quantities until cancelled. A dispatched replacement cannot be undone, and its affected quantities remain fixed.</p>
          <p><strong>Connections:</strong> Orders shows the case status. Case and replacement histories retain notes and references. Replacement inventory movements preserve original SKU snapshots, with location totals updated at dispatch. The original order total, payment, shipping charge, fulfillment tracking and status remain unchanged. Customers see replacement status/tracking separately on their private page; case evidence, carrier claims, stock locations and staff notes stay private.</p>
          <p><strong>Limits:</strong> one case and one non-cancelled replacement per order, with up to 100 case updates, 100 replacement attempts and 100 updates per replacement. The replacement covers all affected items in one shipment to the original address; no substitute SKUs, split replacements, address changes, replacement-of-replacement or automatic return receipts for replacement units. Cancelled preparations may be replaced with a new preparation. Evidence uploads, carrier claims/labels, insurance reimbursement, payment disputes, customer self-service, journal postings and replacement emails remain later work. No new carrier or email service is activated.</p>
        </section>
        <section className="howto-section" id="returns-refunds" aria-labelledby="returns-refunds-title">
          <h2 id="returns-refunds-title">Receive returns and issue test refunds</h2>
          <p>Use this staff-managed workflow after a customer contacts the studio. A super admin records returns and issues refunds; accounting can read the history. Refunding money and receiving items are separate actions. All provider commands use Stripe test mode.</p>
          <ol>
            <li>Open <Link href="/admin/orders">Orders</Link>, choose <strong>View order</strong> or <strong>Open fulfillment</strong>, and select <strong>Load returns and refunds</strong>.</li>
            <li>For a paid order that has not shipped or been collected, first set fulfillment <strong>Status</strong> to <strong>Cancelled</strong> and choose <strong>Save fulfillment</strong>. This releases its stock allocation. Refunds are also available for dispatched or collected orders. Resolve payment review warnings first; late or additional payments use the existing payment review workflow.</li>
            <li>Choose <strong>Refresh Stripe refund status</strong> to check the original payment and refunds issued in Stripe. Enter a full remaining or partial <strong>Refund amount (USD)</strong> and a <strong>Refund reason (staff only)</strong>. Include any shipping you intend to refund. Choose <strong>Issue Stripe test refund</strong>; this submits the amount to Stripe.</li>
            <li>Review the saved status. Pending refunds reserve that amount and block another request. Failed or canceled provider refunds release their pending amount. Refresh again or let the scheduled worker check it. A successful refund leaves inventory and the original order total unchanged.</li>
            <li>Once dispatched or collected items physically return, select the <strong>Returned item</strong>, <strong>Received quantity</strong> and <strong>Return disposition</strong>. Choose a <strong>Receiving location</strong> for retained stock, enter <strong>Return inspection notes (staff only)</strong>, then choose <strong>Record received return</strong>.</li>
          </ol>
          <p><strong>Example:</strong> three $25 prints total $75. Refunding $25 leaves $50 unrefunded and changes no stock. Receiving one print into sellable stock adds one on-hand unit; quarantine adds one on-hand and one unavailable unit. Discarding it records the return without adding inventory. Total returned quantities cannot exceed the three dispatched prints.</p>
          <p><strong>Recovery:</strong> after an uncertain result, use <strong>Retry same refund</strong> or <strong>Retry same return</strong>. Keep the original request; browser storage restores it when possible. For a stale edit, use <strong>Reload returns and refunds</strong> before submitting again. Old uncertain refunds are looked up at the provider before retrying. Requests too old to retry safely remain blocked for administrator reconciliation; do not delete them or start replacement refunds.</p>
          <p><strong>Connections:</strong> retained returns update the selected location, stock balance and inventory history atomically. Quarantine stays unavailable until released through Inventory. Refunds preserve the original payment, fulfillment and order amount. Customers see confirmed/pending refund totals and received-return counts on their private page, without staff notes. No refund or return email is sent by this slice.</p>
          <p><strong>Limits:</strong> no customer return-request portal, exchanges, return labels, automatic journal reversals or policy-based shipping/tax refund calculation. Only stocked variants can be restocked; retained made-to-order returns need administrator inventory reconciliation. Return receipts are immutable: correct stock mistakes through reasoned Inventory adjustments, and ask the administrator to reconcile incorrect return quantities. Each order supports up to 100 refund requests and 100 return receipts; larger histories need administrator export/reconciliation.</p>
          <p><strong>Setup:</strong> deploy the code and add refund.created, refund.updated and refund.failed to the Stripe test webhook subscriptions. The existing authenticated expiry scheduler also checks saved active refund requests. No live account, email sender or carrier service is enabled by this workflow.</p>
        </section>
        <section className="howto-section" id="shipping-rates" aria-labelledby="shipping-rates-title">
          <p className="eyebrow">SHOP / SHIPPING</p>
          <h2 id="shipping-rates-title">Set shipping rates and review checkout totals</h2>
          <p>Set a flat charge for each shipping service and choose supported US destination states. Studio pickup is always free. A super admin changes settings; accounting can review them. Before enabling shipping, agree on the rates and destinations the studio can support. All payments remain test-only, and tax is not calculated.</p>
          <ol>
            <li>Open <Link href="/admin/shipping">Shipping</Link> from the studio navigation.</li>
            <li>Check <strong>Enable standard shipping</strong> or <strong>Enable express shipping</strong> and enter its <strong>rate (USD per order)</strong>. Zero is allowed only when you intend free shipping.</li>
            <li>Choose destination state codes. <strong>Select all destinations</strong> includes all 50 states and Washington, DC. Territories and military destinations are not supported.</li>
            <li>Choose <strong>Save shipping rates</strong>. Disabling a service or removing a destination affects new requests; it does not cancel saved orders. Existing orders retain their original amounts.</li>
            <li>In the public shop, add items to Cart, enter customer details, and choose Studio pickup or Ship to me. For shipping, choose a service and enter a supported state code and ZIP code.</li>
            <li>Choose <strong>Review total</strong>, check Items, shipping, Tax and Total, then <strong>Request order</strong>. Changing details requires another review. If prices or rates changed during review, review the updated total before submitting again.</li>
          </ol>
          <p><strong>Example:</strong> fictional rates of $7.50 standard and $15 express mean two $25 prints total $57.50 with standard shipping, $65 with express, or $50 for pickup. Shipping is charged once per order. Tax remains labeled not calculated; these are test totals, not a decision about tax obligations.</p>
          <p><strong>Connections:</strong> reviewing a total does not hold stock. Requesting an order saves the item prices, shipping charge and total and starts the existing 30-minute stock hold. Stripe test checkout uses that saved total. The private order page, staff order details and new email previews show the same breakdown. Email sending remains disabled until separately configured.</p>
          <p><strong>Recovery:</strong> after a rate conflict, choose <strong>Reload saved rates</strong> before making further edits; it replaces unsaved changes. If a save result is uncertain, keep the page open and use <strong>Retry same save</strong>. If you closed it, inspect saved settings first. Customers use <strong>Retry order request</strong> to recover an uncertain order without repricing or reserving stock twice, even after a rate is disabled. For a definite quote rejection, review the total again. Refresh the shop if its displayed service choices are outdated.</p>
          <p><strong>Order changes:</strong> changing fulfillment method or address after an order is saved does not recalculate its shipping charge or collect/refund a difference. Arrange changes with the customer separately; do not assume a fulfillment edit changes payment. Historical orders show their original total without inventing an itemized shipping or tax amount.</p>
          <p><strong>Limits:</strong> US state and ZIP format checks are not address verification. Live carrier quotes are deferred on the build list. Package sizing, weight-based rates, carrier labels/scans, delivery promises, international shipping, discounts, tax calculation and live launch remain separate work. No default shipping prices are enabled automatically.</p>
        </section>
        <section className="howto-section" id="order-emails" aria-labelledby="order-emails-help-title">
          <p className="eyebrow">ORDERS / CUSTOMER EMAILS</p>
          <h2 id="order-emails-help-title">Keep customers connected to their order</h2>
          <p>New orders have an order-received email preview. Confirmed payments have a separate payment-confirmed preview, including payments accepted after staff review. Each email includes the customer&apos;s private order link. This link works in another browser; keep it private.</p>
          <p>For paid orders, save <strong>Packed</strong> with <strong>Studio pickup</strong> to create a <strong>Ready for pickup</strong> preview. For shipping, save <strong>Shipped</strong> when handing the parcel to the carrier. Changing or removing the <strong>Tracking number</strong> while Shipped creates a <strong>Tracking updated</strong> preview. Notes-only edits and retrying the same save do not create another message. Fulfillment notes and addresses are not included in these emails.</p>
          <p>Before sending: an administrator must configure Resend, a verified sender, and approved test recipients. Until then, sending is disabled. Current messages are labeled TEST and can only go to approved test addresses. Google Workspace can provide the inbox used for replies; it does not process this delivery queue.</p>
          <ol>
            <li>Open <Link href="/admin/orders">Orders</Link>, then <strong>View order</strong> or <strong>Open fulfillment</strong>.</li>
            <li>Under <strong>Order emails</strong>, choose <strong>Load email history</strong>. Accounting can view this history; only super admins can process or retry deliveries.</li>
            <li>Expand <strong>Preview email</strong> to read the message. The private link is hidden in staff previews.</li>
            <li>Once sending is configured, the scheduled stock-release job also checks due emails. A super admin can choose <strong>Process due emails</strong> for this order.</li>
            <li>For <strong>Delivery blocked</strong>, fix the provider configuration or approved recipient list, then choose <strong>Retry delivery</strong>. For an uncertain save, use <strong>Refresh email history</strong> before doing anything else.</li>
          </ol>
          <p><strong>Example:</strong> a fictional $30 test print order queues one order-received message. Confirming payment queues one payment-confirmed message. Repeated payment reports do not queue another copy. Payment still holds stock; packing and collection follow the normal fulfillment workflow.</p>
          <p><strong>Pickup example:</strong> after preparing that paid print, save Packed with Studio pickup. Reopen the order and choose Load email history, then expand Preview email under Ready for pickup. The message asks the customer to confirm a pickup time and location with the studio. The private order page shows Ready for pickup; recording Collected by customer changes it to Collected and consumes stock once.</p>
          <p><strong>Shipping corrections:</strong> correct the Tracking number and save while the order is Shipped. Reopen the order to inspect Tracking updated. Removing a wrong number explicitly tells the customer no tracking number is available. Tracking is plain text; carrier links and automatic carrier scans are not provided. Delivered orders cannot be edited here; contact the administrator to reconcile a mistake.</p>
          <p><strong>Outdated notices:</strong> Not sent: order changed means a pickup or shipping message became outdated before any sending attempt, for example after collection, cancellation, a method change or a newer tracking update. It is not sent or retried. A message already attempted may have reached the provider, so recovery retains its original content; it cannot be recalled. The private order page always shows the latest saved fulfillment details. History shows the 50 most recent messages; older records require administrator review.</p>
          <p><strong>Recovery:</strong> temporary provider failures retry with increasing delays. <strong>Needs review</strong> stops sending when the outcome is uncertain for too long; ask the administrator to compare provider records before any new message. Accepted messages are not resent from this screen. A sender change does not rewrite an already-attempted message. To correct a customer email address, contact the administrator; this screen does not redirect private links to another address.</p>
          <p><strong>Limits:</strong> disabled previews and older orders are not sent automatically when email is enabled. These messages record an event; the private order page shows the latest status if the order later expires or changes. Provider acceptance is not proof of inbox delivery. Bounce tracking, self-service requests for a replacement link, delivery/collection confirmation emails, and live customer sending are not enabled in this version. Email failures never reverse payment or stock changes. Domain, inbox and email-provider setup are deferred; keep sending disabled until activation is arranged.</p>
        </section>
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
              Add relationship labels, such as Printer â€” Primary shop, Gallery
              â€” Booth contact, or Client â€” Commission inquiry. Use Add
              relationship when the same record has more than one role.
            </li>
            <li>
              Add internal notes, then use Log activity to record emails, calls,
              meetings, messages, or notes. Each activity can include an open
              follow-up with details and a completion checkbox. The directory
              shows the newest activity as Last contact and keeps completed
              follow-ups in the contact history. Choose <strong>Save contact</strong>.
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
          id="store-payments"
          aria-labelledby="store-payments-title"
        >
          <p className="eyebrow">SHOP / PAYMENTS</p>
          <h2 id="store-payments-title">Review shop payment events</h2>
          <p>Super admins and accounting can inspect payment reports in Orders.
              Stripe test checkout is available once the administrator configures the test account and signed webhook. Live payments remain disabled.</p>
            <p>The private order page checks payment directly with Stripe on load and when the customer chooses Refresh order status. If a webhook was missed, a matching paid checkout is recorded with a Verification reference in Payment history. A payment discovered after the hold deadline still needs review. For example, a customer who paid but still sees pending payment should refresh their private order instead of paying again. If verification is unavailable, retry the refresh or investigate the Stripe connection.</p>
          <ol>
            <li>Open Orders and choose View order or Open fulfillment.</li>
            <li>Under Payment history, choose Load payment history. Use Refresh
              payment history to check for newer reports without editing fulfillment.</li>
            <li>Read both the provider result and the outcome. Payment confirmed
              means the order was marked paid. No order change means the report
              was recorded without changing the existing order status.</li>
            <li>For Review required, compare the order number, amount, payment ID,
              and event ID with the provider’s records. Check for an extra payment,
              a mismatched amount, or payment after cancellation. Coordinate with
              the studio administrator before arranging a refund or another order.</li>
          </ol>
          <p>Example (fictional): a $50 order is paid and later receives a delayed
            failure report. It stays paid, keeps the successful payment reference,
            and shows the failure as No order change. A different successful $50
            payment on that order is flagged for review instead of replacing the
            original payment.</p>
          <p>Repeated reports do not repeat their effects. Payment confirmation
            does not deduct inventory; shipping or collection does that. A success
            after cancellation does not reopen the order or reserve stock again.
            Historical event means the older report did not record its original
            order effect; do not assume that it proves the current order is paid.</p>
            <p>Super admins resolve Review required in the payment history. For a late payment, choose Accept late payment and reserve stock, enter Resolution notes, then Save review resolution. Stripe must confirm the matching unrefunded payment and enough stock must be available. The closed order becomes paid with a fresh stock hold. If stock is unavailable, no partial hold is saved.</p>
            <p>Alternatively, complete a full refund in the Stripe test dashboard, choose Verify completed Stripe refund, enter its Completed Stripe refund ID and Resolution notes, then save. The app checks the refund with Stripe and records the result; it does not send a refund. Successful payments cannot be dismissed. Dismiss failed-payment review is available only for failed reports. Accounting can read these records but cannot resolve them.</p>
            <p>Example (fictional): a $50 payment arrives after a print hold expired. If two prints remain available, a super admin can accept it and reserve those prints again. If they sold meanwhile, refund the payment in Stripe and verify its refund ID here. The flag clears only when every review on the order has a recorded resolution.</p>
            <p>If the result is unknown, keep the page open and use Retry same resolution. Refresh payment history after a stale-review warning. Historical events without a Stripe account mapping need administrator reconciliation. Received times may differ from payment times. Live collection, partial refunds, automated refunds and ledger postings remain separate workflows.</p>
          <Link className="button secondary" href="/admin/orders">Open orders</Link>
        </section>

        <section
          className="howto-section"
          id="fulfillment"
          aria-labelledby="fulfillment-title"
        >
          <p className="eyebrow">SHOP / FULFILLMENT</p>
          <h2 id="fulfillment-title">Pack, ship, collect, or cancel an order</h2>
          <p>Open Orders in the studio navigation. Super admins manage paid orders;
            accounting can review saved addresses, tracking, notes, and status.</p>
          <ol>
            <li>Choose Open fulfillment on a paid order. Check the recipient and
              address copied from checkout. Choose Studio pickup, Standard shipping,
              or Express shipping. Pickup does not need a postal address.</li>
            <li>Prepare every line, including made-to-order work, then save Packed.
              This keeps stock allocated and does not schedule production.</li>
            <li>For shipping, enter tracking if available and save Shipped when
              handing the parcel to the carrier. This consumes the exact stock
              allocated to this order. Once dispatched, the recipient, address,
              and method cannot change; tracking and notes can still be corrected.</li>
            <li>After delivery, save Delivered. For pickup, save Collected by customer
              directly from Packed when handing over the work. Stock is consumed
              once; confirming a shipped delivery does not deduct it again.</li>
            <li>To stop a paid order before dispatch or collection, save Cancelled.
              This releases its allocations and closes fulfillment. It does not
              refund a payment: arrange and record any refund separately.</li>
          </ol>
          <p>Example (fictional): an order holds two prints at the studio and one
            at a gallery. Dispatch consumes those exact three units, even if the
            location is no longer offered online. Other orders’ allocations stay
            unchanged. Made-to-order lines never draw from stocked balances.</p>
          <p>If a save result is unknown, keep the page open and choose Retry same
            save. Details remain locked until its result is known. If the tab closes,
            reopen Orders and inspect the saved status before making another change.
            A confirmed save followed by a refresh error is still saved: use Refresh
            orders. If someone edited the order elsewhere, Reload saved order discards
            the unsaved form and loads their changes.</p>
          <p>An allocation-review warning means the saved order, stock balance, or
            older fulfillment history needs reconciliation. Check the order’s original
            location allocations, inventory movement history, and physical stock with
            the studio administrator. Do not create replacement orders or guess stock
            adjustments to bypass the warning. Historical migration is not automatic.</p>
          <p>Orders already delivered or cancelled cannot be reopened. Partial
            shipments, post-dispatch returns, refunds, carrier labels, and
            delivery/collection confirmation emails are separate unfinished workflows. Pickup-ready, shipment and tracking-update previews are described in <Link href="#order-emails">Order emails</Link>; delivery remains disabled until configured.</p>
          <Link className="button secondary" href="/admin/orders">Open orders</Link>
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
              under Fulfillment. Shipping requires a supported US address and service. Choose Review total, check the amounts, then Request order once.
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
                studio with their order number for item or address changes. The private View order and payment options link allows status checks, test checkout when enabled, and Cancel unpaid order. Keep that link private and use the same browser when returning from Stripe.
            </li>
          </ol>
          <p>
            Example (fictional): two $25 prints and one $30 print produce an $80
            item subtotal. Three stocked units become allocated while physical
            stock remains unchanged. Merely adding them to the cart holds
            nothing. Review total shows configured shipping charges before Request order. Tax remains uncalculated in test checkout. See <Link href="#shipping-rates">Shipping rates</Link> for setup and examples.
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
              production. New orders hold stock for 30 minutes. A super admin can open the pending order, enter Cancellation reason, and choose Cancel unpaid order to release it sooner. This does not refund a payment; late payments require review. On Orders, Run pending-order expiry check is the manual fallback if the scheduled check is delayed. Existing orders without a deadline are not expired automatically.
            </p>
            <p>Automatic checks must be activated by the administrator. At the deadline the order stops accepting normal payment even if a stock-release check is delayed. Stripe checkout closure may wait for the next check. A failed cancellation can be retried with Retry same cancellation; check the saved order before starting a different request. Live payments, live carrier quotes and tax calculation remain unfinished; email delivery remains deferred.</p>
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
