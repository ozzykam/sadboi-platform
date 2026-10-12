export function CommissionBillingHelp() {
  return (
    <section
      className="howto-section"
      id="commission-billing"
      aria-labelledby="commission-billing-title"
    >
      <h2 id="commission-billing-title">
        Invoice commission deposits and balances
      </h2>
      <p>
        Start with a signed agreement. Open Invoices in the staff navigation, or
        Open invoices on its agreement page. Super admins manage billing;
        accounting can review and print.
      </p>
      <ol>
        <li>
          Choose Add invoice. Select Deposit, Milestone or Final balance, then
          enter the description, amount in USD, due date and client-facing
          payment instructions. Add a Private action note and choose Save
          invoice draft.
        </li>
        <li>
          Review the saved document. Enter another action note and choose Issue
          saved invoice. This assigns a CI invoice number and freezes the saved
          amount and terms. The due date must be today or later when issuing.
        </li>
        <li>
          Choose Print / save PDF and share the file yourself. Disable browser
          headers and footers to keep the staff URL off the PDF. Issuing does
          not send an email or create a public payment link.
        </li>
        <li>
          After verifying a payment received elsewhere, enter its amount,
          received date, method and private evidence/reference, plus a Private
          action note. Choose Record received payment. Partial payments reduce
          the invoice balance; full payment marks it paid.
        </li>
        <li>
          If a payment was recorded incorrectly, add an action note explaining
          the correction and choose Reverse payment record on that entry. The
          original remains in history. This corrects the record only; it does
          not send money or issue a refund.
        </li>
      </ol>
      <p>
        <strong>Example:</strong> a signed $550 commission can have a $275
        deposit and a $275 final balance. Drafts reserve their amounts, so
        adding both leaves $0 unallocated. The final invoice uses the amount not
        already reserved by other invoices, including unpaid ones; it does not
        bill the deposit twice. A $100 payment toward the issued deposit leaves
        $175 due on that invoice.
      </p>
      <p>
        <strong>What to enter:</strong> title “Album-cover deposit”; description
        “First installment of the signed album-cover commission”; amount
        “275.00”; payment instructions “Please use the payment method agreed
        with the studio and include this invoice number in your reference.”
        Enter the actual arrangements agreed with your client. A private payment
        reference might be “Bank receipt ABC123, verified October 5”; it is not
        printed. For one payment split across invoices, record only each
        allocation and use distinct references such as “ABC123 / deposit” and
        “ABC123 / final.”
      </p>
      <p>
        <strong>Balances:</strong> Agreement total is the accepted proposal
        total, including its saved discount and tax. Installments divide that
        total; no extra tax or fees are added. Unallocated excludes all active
        drafts and issued invoices. Outstanding is issued amounts minus recorded
        payments. Remaining agreement balance also includes amounts not yet
        issued. Overdue means an issued invoice still has a balance after its
        UTC due date; it does not send reminders.
      </p>
      <p>
        <strong>Corrections and recovery:</strong> edit drafts freely. To
        replace an issued unpaid invoice, void it and create a new draft;
        invoice numbers and history are retained. An invoice with recorded
        payments cannot be voided. Do not reverse a real payment just to bypass
        that restriction. Reload billing discards unsaved edits. After an
        uncertain save, use Retry same billing action or Recover interrupted
        action in the same browser tab before starting another action.
      </p>
      <p>
        <strong>Limits:</strong> USD only, 20 invoices including voids per
        agreement, 20 payment records including reversals per invoice and 200
        saved changes per agreement. A voided agreement blocks new drafts and
        issuing but keeps existing payment recording and correction available.
        This workflow does not collect Stripe payments, verify bank receipts,
        send email, post accounting journals, process refunds or release project
        deliverables. Payment records are staff-reported; billing does not
        change project status.
      </p>
    </section>
  );
}
