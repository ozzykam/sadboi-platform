import { ProposalFieldExamples } from "./proposal-field-examples";

export function AgreementHelp() {
  return (
    <section
      className="howto-section"
      id="agreements"
      aria-labelledby="agreements-title"
    >
      <h2 id="agreements-title">Prepare and sign agreements</h2>
      <p>
        Start with an accepted proposal. Super admins and legal staff prepare
        agreements and invitations; accounting reads saved documents and
        history.
      </p>
      <ProposalFieldExamples />
      <ol>
        <li>
          Open Agreements in the staff navigation, select the accepted proposal,
          and enter the Agreement title, Agreement terms and dates. Enter your
          reviewed terms; the accepted proposal is attached in full and its
          total stays fixed.
        </li>
        <li>
          Add a Private action note and choose Save draft. Review the saved
          document, then choose Create signing link. Save pending edits before
          creating a link.
        </li>
        <li>
          Copy the Private signing link and share it with the intended client
          through your own channel. The link gives access to this document and
          signing, so keep it private. It expires after seven days. Creating it
          does not send an email.
        </li>
        <li>
          The client opens the link, chooses Load agreement, reviews both the
          terms and attached proposal, enters their full name and declared
          signing date, checks the consent box, and chooses Sign agreement.
        </li>
        <li>
          Reload saved agreement to see the signature and its history. Use Print
          / save PDF for the displayed document; turn off browser headers and
          footers before sharing a copy.
        </li>
      </ol>
      <p>
        <strong>Changes and recovery:</strong> Replace signing link invalidates
        the previous link. Revoke link and reopen draft cancels signing access
        and lets you correct the terms. Signed documents remain frozen; Void
        agreement records the studio decision and invalidates access while
        retaining the signature and history. A void status alone does not cancel
        obligations outside this system. Amendments are a later workflow.
      </p>
      <p>
        If a save is uncertain, use Retry same action. Recover interrupted
        action restores the request in the same browser tab. Reload saved
        agreement discards unsaved changes. If storage is unavailable, check the
        saved status and history first. If you lose a signing link, replace it.
        The client can retry the same signature after a connection failure; it
        is recorded once.
      </p>
      <p>
        <strong>Fictional example:</strong> open an accepted $550 album-cover
        proposal, enter reviewed commission terms, save, and create a link. The
        client sees that exact agreement with the $550 proposal attached.
        Signing records consent and dates without creating an invoice,
        collecting a deposit or starting project work.
      </p>
      <p>
        <strong>Limits:</strong> one agreement per proposal series and 100
        history entries. Link possession grants access; it does not
        independently verify identity. Staff can separately Record external
        signature with a full name, date and evidence reference. That record is
        labelled as staff-recorded. Countersignatures, attachments, amendments,
        automated sending and legal templates are not included.
      </p>
    </section>
  );
}
