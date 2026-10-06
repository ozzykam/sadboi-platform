import type { publicAgreement } from "@/server/agreements";
export type AgreementDocumentRecord = ReturnType<typeof publicAgreement>;
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export function AgreementDocument({
  record,
}: {
  record: AgreementDocumentRecord;
}) {
  const proposal = record.proposalSnapshot;
  return (
    <article className="proposal-document agreement-document">
      <p className="eyebrow">SADBOI / AGREEMENT</p>
      <h2>{record.input.title}</h2>
      <p>
        Prepared for {record.client.name} · {record.client.email}
      </p>
      <p>
        Status: {record.state} · Revision {record.revision}
      </p>
      <p>
        Effective {record.input.effectiveDate}
        {record.input.expiresDate && ` · Expires ${record.input.expiresDate}`}
      </p>
      <p>Agreed total: {money(record.input.totalMinor)}</p>
      <h3>Agreement terms</h3>
      <p className="preserve-lines">{record.input.body}</p>
      {proposal && (
        <section aria-label="Attached accepted proposal">
          <h3>
            Attached accepted proposal {record.proposalNumber} · Version{" "}
            {record.proposalVersion}
          </h3>
          <h4>{proposal.title}</h4>
          <p>Original offer valid through {proposal.validUntil} (UTC) · Currency: {proposal.currency}</p>
          <h4>Scope</h4>
          <p className="preserve-lines">{proposal.scope}</p>
          <h4>Deliverables</h4>
          <p className="preserve-lines">{proposal.deliverables}</p>
          <h4>Timing</h4>
          <p className="preserve-lines">{proposal.timeline}</p>
          <h4>Revisions</h4>
          <p className="preserve-lines">{proposal.revisionPolicy}</p>
          <h4>Price</h4>
          <div className="proposal-lines">
            {proposal.lines.map((line, i) => (
              <div key={i}>
                <strong>{line.description}</strong>
                <span>
                  {line.quantity} × {money(line.unitMinor)}
                </span>
                <span>{money(line.quantity * line.unitMinor)}</span>
              </div>
            ))}
          </div>
          <p>
            Discount: {money(proposal.discountMinor)} · Tax:{" "}
            {money(proposal.taxMinor)} (
            {proposal.taxStatus.replaceAll("_", " ")})
          </p>
          <p className="preserve-lines">{proposal.taxNote}</p>
          {proposal.terms && (
            <>
              <h4>Additional proposal terms</h4>
              <p className="preserve-lines">{proposal.terms}</p>
            </>
          )}
        </section>
      )}
      {record.signedAt && (
        <section>
          <h3>Signature record</h3>
          <p>
            {record.signerName} · Declared date {record.signedDate}
          </p>
          <p>
            Recorded {record.signedAt} ·{" "}
            {record.signatureMethod === "client_link"
              ? "Signed through private invitation"
              : "Recorded by staff from external evidence"}
          </p>
          {record.consentText && <p>{record.consentText}</p>}
        </section>
      )}
      <p className="field-hint">
        Document reference: {record.documentHash || "Historical document"}
      </p>
    </article>
  );
}
