import {
  commissionInvoicePaid,
  commissionInvoiceStatus,
  proposalTotals,
  type CommissionInvoice,
} from "@sadboi/core";
import type { CommissionBillingRecord } from "@/server/commission-billing";
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
export function CommissionInvoiceDocument({
  invoice,
  source,
  historical = false,
  today,
}: {
  invoice: CommissionInvoice;
  source: CommissionBillingRecord["source"];
  historical?: boolean;
  today: string;
}) {
  const paid = commissionInvoicePaid(invoice);
  return (
    <article
      className="proposal-document commission-invoice-document"
      aria-label="Commission invoice document"
    >
      <p className="eyebrow">SADBOI STUDIO / COMMISSION INVOICE</p>
      <h2>{invoice.input.title}</h2>
      <p>
        <strong>{invoice.number ?? "Unnumbered draft"}</strong> ·{" "}
        {commissionInvoiceStatus(invoice, today).replaceAll("_", " ")}
      </p>
      {historical && (
        <p>
          <strong>
            Historical snapshot — consult the current invoice for its latest
            balance.
          </strong>
        </p>
      )}
      {invoice.state === "draft" && (
        <p>
          <strong>DRAFT — not issued; not a request for payment.</strong>
        </p>
      )}
      {invoice.state === "void" && (
        <p>
          <strong>VOID — no payment is requested on this invoice.</strong>
        </p>
      )}
      <p>
        Prepared for {source.client.name}
        {source.client.email ? ` · ${source.client.email}` : ""}
      </p>
      <p>
        Agreement: {source.title} · Signed {source.signedAt.slice(0, 10)}
      </p>
      <p>
        Proposal: {source.proposalNumber} · Version {source.proposalVersion}
      </p>
      <p>
        {invoice.issuedAt ? `Issued ${invoice.issuedAt.slice(0, 10)} · ` : ""}
        Due {invoice.input.dueDate} (UTC)
      </p>
      <h3>
        {invoice.input.kind === "final"
          ? "Final balance"
          : invoice.input.kind === "deposit"
            ? "Deposit"
            : "Milestone"}
      </h3>
      <p className="preserve-lines">{invoice.input.description}</p>
      <dl className="proposal-totals">
        <div>
          <dt>Invoice amount (USD)</dt>
          <dd>{money(invoice.input.amountMinor)}</dd>
        </div>
        <div>
          <dt>Payments recorded by studio</dt>
          <dd>{money(paid)}</dd>
        </div>
        <div>
          <dt>
            <strong>Balance due</strong>
          </dt>
          <dd>
            <strong>
              {money(
                invoice.state === "issued"
                  ? invoice.input.amountMinor - paid
                  : 0,
              )}
            </strong>
          </dd>
        </div>
      </dl>
      <h3>Payment instructions</h3>
      <p className="preserve-lines">{invoice.input.paymentInstructions}</p>
      <h3>Agreement total reference</h3>
      <p>
        This installment is part of the {money(source.totalMinor)} agreed total.
        It is not an additional charge. The accepted proposal contains the
        itemized scope and pricing.
      </p>
      <p>
        Proposal subtotal {money(proposalTotals(source.proposal).subtotalMinor)}{" "}
        · Discount {money(source.proposal.discountMinor)} · Tax{" "}
        {money(source.proposal.taxMinor)}. No tax or fees are added by this
        installment.
      </p>
      <p className="preserve-lines">{source.proposal.taxNote}</p>
      <p>
        Payment amounts reflect the studio’s records. Please contact the studio
        with any questions about this invoice.
      </p>
    </article>
  );
}
