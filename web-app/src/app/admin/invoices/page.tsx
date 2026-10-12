import Link from "next/link";
import { requireStaff } from "@/server/staff";
import { commissionBillingDirectory } from "@/server/commission-billing";
import { PageHeading } from "@/components/ui";
import { CommissionBillingHelp } from "@/components/commission-billing-help";
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
export default async function Page() {
  const rows = await commissionBillingDirectory(
    await requireStaff(["super_admin", "accounting"]),
  );
  return (
    <>
      <PageHeading
        eyebrow="STUDIO / COMMISSION BILLING"
        title="Invoices"
        description="Manage deposits, milestone invoices and final balances for signed commissions."
      />
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
