import Link from "next/link";
import { requireStaff } from "@/server/staff";
import { agreementDirectory } from "@/server/agreements";
import { PageHeading } from "@/components/ui";
import { AgreementHelp } from "@/components/agreement-help";
export default async function Page() {
  const staff = await requireStaff(["super_admin", "legal", "accounting"]);
  const rows = await agreementDirectory(staff);
  return (
    <>
      <PageHeading
        eyebrow="STUDIO / AGREEMENTS"
        title="Agreements"
        description="Prepare agreements from accepted proposals and review signing progress."
      />
      <p>
        <a href="#agreements">How to manage agreements</a>
      </p>
      {!rows.length && (
        <p className="empty-state">
          Accepted proposals will appear here when ready for an agreement.
        </p>
      )}
      <div className="inbox-table-wrap">
        <table className="inbox-table">
          <caption className="sr-only">
            Agreements and accepted proposals
          </caption>
          <thead>
            <tr>
              <th scope="col">Agreement</th>
              <th scope="col">Client</th>
              <th scope="col">Proposal</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Link
                    className="inbox-row-link"
                    href={`/admin/projects/agreement?proposalId=${row.id}`}
                  >
                    {row.title}
                  </Link>
                </th>
                <td>{row.clientName}</td>
                <td>{row.number}</td>
                <td>
                  <span className="inbox-status">
                    {row.state.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AgreementHelp />
    </>
  );
}
