import Link from "next/link";
import { requireStaff } from "@/server/staff";
import { commissionBillingDirectory } from "@/server/commission-billing";
import { PageHeading } from "@/components/ui";
import { CommissionBillingHelp } from "@/components/commission-billing-help";
import { studioInvoiceDirectory } from "@/server/studio-invoices";
import {
  studioInvoicePaid,
  studioInvoiceStatus,
  studioInvoiceTotals,
} from "@sadboi/core";
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
export default async function Page() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  const [rows, invoices] = await Promise.all([
    commissionBillingDirectory(staff),
    studioInvoiceDirectory(staff),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeading
        eyebrow="STUDIO / BILLING"
        title="Invoices"
        description="Create itemized invoices, track received payments, and manage billing for signed commissions."
      />
      {staff.role === "super_admin" && (
        <div className="invoice-toolbar">
          <Link href="/admin/invoices/new" className="button">
            New invoice
          </Link>
          <Link href="/admin/settings/invoices" className="button secondary">
            Invoice defaults
          </Link>
          <Link href="/admin/invoices/new?starter=flight-of-the-conchords">
            Start Flight of the Conchords draft
          </Link>
        </div>
      )}
      <h2>Standalone invoices</h2>
      <p>
        <Link href="/admin/how-to#studio-invoices">
          How to create standalone invoices
        </Link>
      </p>
      {!invoices.length ? (
        <p className="empty-state">
          Create an invoice without a signed proposal. Drafts can keep
          incomplete billing and tax details while you confirm them.
        </p>
      ) : (
        <div className="inbox-table-wrap">
          <table className="inbox-table">
            <caption className="sr-only">Standalone invoices</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Bill to</th>
                <th scope="col">Status</th>
                <th scope="col">Total</th>
                <th scope="col">Balance due</th>
                <th scope="col">Due date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <th scope="row">
                    <Link
                      className="inbox-row-link"
                      href={`/admin/invoices/${invoice.id}`}
                    >
                      {invoice.input.title}
                      <small>{invoice.number ?? "Unnumbered draft"}</small>
                    </Link>
                  </th>
                  <td>{invoice.input.billTo.name}</td>
                  <td>{studioInvoiceStatus(invoice, today)}</td>
                  <td>
                    {money(studioInvoiceTotals(invoice.input).totalMinor)}
                    {invoice.input.taxStatus === "unresolved" && (
                      <small>Before tax · needs review</small>
                    )}
                  </td>
                  <td>
                    {invoice.state === "issued"
                      ? money(
                          studioInvoiceTotals(invoice.input).totalMinor -
                            studioInvoicePaid(invoice),
                        )
                      : "—"}
                  </td>
                  <td>{invoice.dueDate ?? "Not issued"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="invoice-panel">
        <summary>How to create a standalone invoice</summary>
        <ol>
          <li>
            Set your studio billing details and reusable wording under Invoice
            defaults.
          </li>
          <li>
            Create a draft. Enter the recipient and itemized USD charges;
            unknown tax treatment stays Needs review.
          </li>
          <li>
            Add payment instructions and, for Stripe, a payment link created in
            your Stripe account.
          </li>
          <li>
            Keep new usage restrictions marked Proposed until the client agrees.
            Recording acceptance requires a private evidence reference; this
            does not create a signature.
          </li>
          <li>
            Save and review. Issue assigns a permanent number and a due date.
            Nothing is sent automatically.
          </li>
          <li>
            Open Print / save PDF. Check the exported file before sharing.
            Record payments only after verifying receipt externally.
          </li>
        </ol>
        <p>
          Signed commission installments remain in the agreement workflow below.
          Standalone invoices do not reserve or reduce an agreement’s billing
          balance; avoid invoicing the same work twice.
        </p>
      </details>
      <h2>Signed commission billing</h2>
      <p>
        <a href="#commission-billing">How to manage commission invoices</a>
      </p>
      {!rows.length && (
        <p className="empty-state">
          Signed commission agreements appear here when ready for billing.
        </p>
      )}
      <div className="inbox-table-wrap">
        <table className="inbox-table">
          <caption className="sr-only">Commission billing by agreement</caption>
          <thead>
            <tr>
              <th scope="col">Commission</th>
              <th scope="col">Client</th>
              <th scope="col">Agreement total</th>
              <th scope="col">Issued</th>
              <th scope="col">Payments recorded</th>
              <th scope="col">Outstanding invoices</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Link
                    className="inbox-row-link"
                    href={`/admin/projects/invoices?proposalId=${row.id}`}
                  >
                    {row.title}
                    <small>
                      {row.proposalNumber}
                      {row.agreementState === "voided"
                        ? " · Agreement voided"
                        : ""}
                    </small>
                  </Link>
                </th>
                <td>{row.clientName}</td>
                <td>{money(row.totalMinor)}</td>
                <td>{money(row.invoicedMinor)}</td>
                <td>{money(row.paidMinor)}</td>
                <td>{money(row.outstandingMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CommissionBillingHelp />
    </>
  );
}
