import {
  studioInvoicePaid,
  studioInvoiceTotals,
  studioInvoiceStatus,
  type StudioInvoice,
} from "@sadboi/core";
import Image from "next/image";
import studioLogo from "../../public/images/logo-portrait-blk.webp";
export const invoiceMoney = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
const invoiceDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date.slice(0, 10) + "T12:00:00Z"));
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
  const status = studioInvoiceStatus(invoice, today);
  return (
    <article className="studio-invoice-document" aria-label="Invoice document">
      <header className="invoice-document-heading">
        <div className="invoice-studio-identity">
          <Image
            className="invoice-studio-logo"
            src={studioLogo}
            alt=""
            loading="eager"
            unoptimized
          />
          <div>
            <p className="invoice-overline">{input.issuer.name}</p>
            {input.issuer.address && (
              <p className="preserve-lines">{input.issuer.address}</p>
            )}
            {input.issuer.email && <p>{input.issuer.email}</p>}
          </div>
        </div>
        <div className="invoice-document-reference">
          <h1>Invoice</h1>
          <p className="invoice-number">
            {invoice.number ?? "Unnumbered draft"}
          </p>
          <span className="invoice-status">{status}</span>
        </div>
      </header>
      {invoice.state === "draft" && (
        <p className="invoice-document-notice">
          <strong>Draft</strong> Not a request for payment.
        </p>
      )}
      {invoice.state === "void" && (
        <p className="invoice-document-notice">
          <strong>Void</strong> Do not pay this invoice.
        </p>
      )}
      <div className="invoice-document-parties">
        <section className="invoice-bill-to">
          <h3>Bill to</h3>
          <p className="invoice-recipient">{input.billTo.name}</p>
          {!input.billTo.confirmed && (
            <p className="invoice-provisional">Provisional recipient</p>
          )}
          {input.billTo.address && (
            <p className="preserve-lines">{input.billTo.address}</p>
          )}
          {input.billTo.email && <p>{input.billTo.email}</p>}
        </section>
        <dl className="invoice-date-summary">
          <div>
            <dt>Issue date</dt>
            <dd>
              {invoice.issuedAt ? invoiceDate(invoice.issuedAt) : "Not issued"}
            </dd>
          </div>
          <div>
            <dt>Payment due</dt>
            <dd>
              {invoice.dueDate
                ? invoiceDate(invoice.dueDate)
                : `${input.dueDays} days after issue`}
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>USD</dd>
          </div>
        </dl>
      </div>
      <section className="invoice-project">
        <p className="invoice-overline">Project / services</p>
        <h2>{input.title}</h2>
      </section>
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
              <td>
                <div className="invoice-line-description">
                  <span className="invoice-line-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="preserve-lines">{line.description}</span>
                </div>
              </td>
              <td>{line.quantity}</td>
              <td>{invoiceMoney(line.unitMinor)}</td>
              <td className="invoice-line-amount">
                {invoiceMoney(line.quantity * line.unitMinor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="invoice-settlement">
        <section className="invoice-payment-instructions">
          {invoice.state !== "void" && (
            <>
              <h3>Payment instructions</h3>
              <p className="preserve-lines">{input.paymentInstructions}</p>
              {input.stripePaymentUrl ? (
                <a
                  className="invoice-payment-link"
                  href={input.stripePaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <strong>Pay securely with Stripe ↗</strong>
                  <span>{input.stripePaymentUrl}</span>
                </a>
              ) : (
                input.paymentMethod === "stripe" && (
                  <p className="invoice-fine-print">
                    Stripe payment link pending.
                  </p>
                )
              )}
            </>
          )}
          {input.taxNote && (
            <div className="invoice-tax-note">
              <h3>Tax treatment</h3>
              <p className="preserve-lines">{input.taxNote}</p>
            </div>
          )}
        </section>
        <dl className="invoice-document-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{invoiceMoney(totals.subtotalMinor)}</dd>
          </div>
          {input.discountMinor > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>-{invoiceMoney(input.discountMinor)}</dd>
            </div>
          )}
          <div>
            <dt>Tax</dt>
            <dd>
              {input.taxStatus === "unresolved"
                ? "Needs review"
                : input.taxStatus === "not_applicable"
                  ? "Not applicable"
                  : invoiceMoney(input.taxMinor)}
            </dd>
          </div>
          <div
            className={
              invoice.state === "issued"
                ? "invoice-total-line"
                : "invoice-balance-line"
            }
          >
            <dt>{input.taxStatus === "unresolved" ? "Before tax" : "Total"}</dt>
            <dd>{invoiceMoney(totals.totalMinor)}</dd>
          </div>
          {invoice.state === "issued" && (
            <>
              {paid > 0 && (
                <div>
                  <dt>Payments recorded</dt>
                  <dd>{invoiceMoney(paid)}</dd>
                </div>
              )}
              <div className="invoice-balance-line">
                <dt>Balance due</dt>
                <dd>{invoiceMoney(totals.totalMinor - paid)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
      {(input.agreementReference ||
        input.usage.status !== "none" ||
        input.notes) && (
        <div className="invoice-document-terms">
          {input.agreementReference && (
            <section>
              <h3>Agreement reference</h3>
              <p>{input.agreementReference}</p>
            </section>
          )}
          {input.usage.status !== "none" && (
            <section>
              <h3>
                {input.usage.status === "proposed"
                  ? "Proposed usage terms"
                  : "Usage terms"}
              </h3>
              <p className="invoice-terms-status">
                {input.usage.status === "proposed"
                  ? "Awaiting client approval. No acceptance of these proposed terms has been recorded. Please confirm them with the studio."
                  : "Client approval recorded by studio."}
              </p>
              <p className="preserve-lines">{input.usage.text}</p>
            </section>
          )}
          {input.notes && (
            <section>
              <h3>Notes</h3>
              <p className="preserve-lines">{input.notes}</p>
            </section>
          )}
        </div>
      )}
      <footer className="invoice-document-footer">
        <p>Thank you for supporting independent art.</p>
        <p>
          {input.issuer.name}
          {invoice.number && ` / ${invoice.number}`}
        </p>
        {!!invoice.payments.length && (
          <p className="invoice-fine-print">
            Payment amounts reflect the studio’s records. Contact the studio
            with any questions.
          </p>
        )}
      </footer>
    </article>
  );
}
