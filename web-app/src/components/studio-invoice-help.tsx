import Link from "next/link";
export function StudioInvoiceHelp() {
  return (
    <section
      className="howto-section"
      id="studio-invoices"
      aria-labelledby="studio-invoices-title"
    >
      <h2 id="studio-invoices-title">Create standalone invoices</h2>
      <p>
        Use <Link href="/admin/invoices">Invoices</Link> for itemized custom
        artwork or other work that is not already billed through a signed
        commission agreement. Super admins manage invoices and defaults;
        accounting can review and print.
      </p>
      <ol>
        <li>
          Open Invoice defaults. Add the studio billing name, email/address,
          Days to pay after issue, and reusable payment instructions or usage
          language. Defaults are copied into new drafts; they do not change
          existing invoices.
        </li>
        <li>
          Choose New invoice, or Start Flight of the Conchords draft for the
          requested $1,800 poster and $500 tea towel artwork. Choose a contact
          or enter the recipient directly. Keep the confirmation box unchecked
          while the billing name is provisional.
        </li>
        <li>
          Add descriptions, quantities and unit prices in USD. For a service,
          quantity 1 is one charge for that work, not the number of printed
          merchandise units. For this job, the subtotal is $2,300 before any
          tax.
        </li>
        <li>
          Leave Tax treatment as Needs review until confirmed. For Calculated
          externally, enter the total tax amount and a Tax explanation. Not
          applicable — confirmed also requires an explanation. The app does not
          determine tax obligations.
        </li>
        <li>
          Set Days to pay after issue to 30 for net-30. Choose Stripe payment
          link and paste the invoice-specific HTTPS link from Stripe. Check its
          amount, currency and recipient in Stripe. The app does not create
          Stripe invoices or synchronize payments.
        </li>
        <li>
          Keep newly introduced usage restrictions marked Proposed — awaiting
          client approval. For example: “Use is limited to posters and tea
          towels. Other merchandise requires Sadboi’s express written permission
          in advance.” Tailor the wording to the actual agreement. To mark
          Client has agreed, record who agreed, when, and where the approval is
          saved in Private acceptance reference. Editing the wording returns it
          to proposed.
        </li>
        <li>
          Add a Private change note, such as “Prepared draft while confirming
          billing recipient and tax,” and Save draft. Review the saved document.
          Once the required details are complete, add a Private action note and
          Issue invoice. This freezes the details, assigns a number such as
          261106-JER-001 (last draft save date in Chicago time, first three
          letters of the billed-to name, and a continuous sequence), and
          calculates the due date in UTC calendar days. Issuing does not send
          anything or record a signature.
        </li>
        <li>
          Open Print / save PDF. Choose Save as PDF in the browser print dialog
          and turn off headers and footers. Check the exported document before
          sharing it; the staff page URL is not a client link.
        </li>
        <li>
          After verifying money arrived, open Record a received payment. Enter
          the amount, date, method and private provider/reference details.
          Partial payments update the balance. Reverse record corrects a
          mistaken entry without issuing a refund. Add an action note before
          each change.
        </li>
      </ol>
      <p>
        Invoice amounts and terms cannot be edited after issue. An unpaid
        invoice can be voided with an action note and replaced with a new draft;
        its number and history remain. Changing the default wording cannot amend
        issued terms. For a formal client signature, use the existing
        proposal-to-Agreements workflow.
      </p>
      <p>
        If a request is interrupted, use Retry on the invoice page before making
        another change. The same request can be recovered in the same browser
        tab after reload. Private change notes, payment references, and
        acceptance evidence are excluded from the print page.
      </p>
      <p>
        Standalone invoices do not reserve or reduce a signed agreement’s
        billing allocation, create shop orders, adjust stock, post ledger
        entries, or send emails. Use the signed commission billing workflow for
        existing installments to avoid billing the same work twice.
      </p>
    </section>
  );
}
