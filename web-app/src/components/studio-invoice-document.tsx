import {
  studioInvoicePaid,
  studioInvoiceTotals,
  studioInvoiceStatus,
  type StudioInvoice,
} from "@sadboi/core";
export const invoiceMoney = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
export function StudioInvoiceDocument({
  invoice,
  today,
}: {
  invoice: StudioInvoice;
  today: string;
}) {
  const { input } = invoice,
    totals = studioInvoiceTotals(input),
    paid = studioInvoicePaid(invoice);
  return (
    <article className="studio-invoice-document" aria-label="Invoice document">
      <header className="invoice-document-heading">
        <div>
          <p className="eyebrow">{input.issuer.name}</p>
          <h1>Invoice</h1>
          <p>{invoice.number ?? "Unnumbered draft"}</p>
        </div>
        <div>
          <p className="preserve-lines">{input.issuer.address}</p>
          <p>{input.issuer.email}</p>
        </div>
      </header>
      {invoice.state === "draft" && (
        <p className="invoice-document-notice">
          DRAFT — not a request for payment.
        </p>
      )}
      {invoice.state === "void" && (
        <p className="invoice-document-notice">
          VOID — do not pay this invoice.
        </p>
      )}
      <h2>{input.title}</h2>
      <div className="invoice-document-parties">
        <section>
          <h3>Bill to</h3>
          <p>
            {input.billTo.name}
            {!input.billTo.confirmed && " (provisional recipient)"}
          </p>
          <p className="preserve-lines">{input.billTo.address}</p>
          <p>{input.billTo.email}</p>
        </section>
        <dl>
          <dt>Issued</dt>
          <dd>{invoice.issuedAt?.slice(0, 10) ?? "Not issued"}</dd>
          <dt>Due</dt>
          <dd>{invoice.dueDate ?? `${input.dueDays} days after issue`}</dd>
          <dt>Currency</dt>
          <dd>USD</dd>
          <dt>Status</dt>
          <dd>{studioInvoiceStatus(invoice, today)}</dd>
        </dl>
      </div>
      <table className="invoice-document-lines">
        <caption className="sr-only">Itemized charges in USD</caption>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Qty</th>
            <th scope="col">Unit price</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {input.lines.map((line, index) => (
            <tr key={index}>
              <td className="preserve-lines">{line.description}</td>
              <td>{line.quantity}</td>
              <td>{invoiceMoney(line.unitMinor)}</td>
              <td>{invoiceMoney(line.quantity * line.unitMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-document-totals">
        <dt>Subtotal</dt>
        <dd>{invoiceMoney(totals.subtotalMinor)}</dd>
        <dt>Discount</dt>
        <dd>{invoiceMoney(input.discountMinor)}</dd>
        <dt>Tax</dt>
        <dd>
          {input.taxStatus === "unresolved"
            ? "Needs review"
            : input.taxStatus === "not_applicable"
              ? "Not applicable"
              : invoiceMoney(input.taxMinor)}
        </dd>
        <dt>{input.taxStatus === "unresolved" ? "Before tax" : "Total"}</dt>
        <dd>{invoiceMoney(totals.totalMinor)}</dd>
        {invoice.state === "issued" && (
          <>
            <dt>Payments recorded</dt>
            <dd>{invoiceMoney(paid)}</dd>
            <dt>Balance due</dt>
            <dd>{invoiceMoney(totals.totalMinor - paid)}</dd>
          </>
        )}
      </dl>
      {input.taxNote && (
        <p className="preserve-lines">Tax treatment: {input.taxNote}</p>
      )}
      {invoice.state !== "void" && (
        <section>
          <h3>Payment</h3>
          <p className="preserve-lines">{input.paymentInstructions}</p>
          {input.stripePaymentUrl ? (
            <p>
              <a
                href={input.stripePaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {input.stripePaymentUrl}
              </a>
            </p>
          ) : (
            input.paymentMethod === "stripe" && (
              <p>Stripe payment link pending.</p>
            )
          )}
        </section>
      )}
      {input.agreementReference && (
        <p>Agreement reference: {input.agreementReference}</p>
      )}
      {input.usage.status !== "none" && (
        <section>
          <h3>
            {input.usage.status === "proposed"
              ? "Proposed usage terms — awaiting client approval"
              : "Usage terms — client approval recorded by studio"}
          </h3>
          {input.usage.status === "proposed" && (
            <p>
              No acceptance of these proposed terms has been recorded. Please
              confirm them with the studio.
            </p>
          )}
          <p className="preserve-lines">{input.usage.text}</p>
        </section>
      )}
      {input.notes && (
        <section>
          <h3>Notes</h3>
          <p className="preserve-lines">{input.notes}</p>
        </section>
      )}
      {!!invoice.payments.length && (
        <p>
          Payment amounts reflect the studio’s records. Contact the studio with
          any questions.
        </p>
      )}
    </article>
  );
}
