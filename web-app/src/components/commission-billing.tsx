"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  commissionBillingCommandSchema,
  commissionBillingTotals,
  commissionInvoicePaid,
  commissionInvoiceStatus,
  parseCommissionBudget,
  type CommissionBillingCommand,
  type CommissionInvoice,
  type CommissionInvoiceInput,
} from "@sadboi/core";
import type { commissionBillingDetail } from "@/server/commission-billing";
import {
  inventoryRequest,
  InventoryRequestError,
} from "@/lib/inventory-client";
import { Button, Input, Textarea, PageHeading } from "./ui";
import { CommissionInvoiceDocument } from "./commission-invoice-document";
import { CommissionBillingHelp } from "./commission-billing-help";
type Detail = Awaited<ReturnType<typeof commissionBillingDetail>>;
type Action =
  | { action: "save"; input: CommissionInvoiceInput }
  | { action: "issue" | "void" }
  | {
      action: "recordPayment";
      payment: Extract<
        CommissionBillingCommand,
        { action: "recordPayment" }
      >["payment"];
    }
  | { action: "reversePayment"; paymentId: string };
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
function InvoiceDraft({
  invoice,
  available,
  disabled,
  onSave,
  onIssue,
}: {
  invoice?: CommissionInvoice;
  available: number;
  disabled: boolean;
  onSave: (input: CommissionInvoiceInput) => void;
  onIssue: () => void;
}) {
  const [input, setInput] = useState<CommissionInvoiceInput>(
    invoice?.input ?? {
      title: "",
      kind: "deposit",
      description: "",
      amountMinor: 0,
      dueDate: "",
      paymentInstructions: "",
    },
  );
  const [amount, setAmount] = useState(
      invoice ? (invoice.input.amountMinor / 100).toFixed(2) : "",
    ),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const amountMinor = parseCommissionBudget(amount);
          if (!amountMinor) throw new Error("Enter a positive amount in USD.");
          setError("");
          onSave({ ...input, amountMinor });
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <fieldset className="commission-fields inv-form" disabled={disabled}>
        <legend>{invoice ? "Edit invoice draft" : "New invoice draft"}</legend>
        <Input
          label="Invoice title"
          required
          minLength={3}
          maxLength={180}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
        />
        <label className="field">
          Installment type
          <select
            value={input.kind}
            onChange={(e) => {
              const kind = e.target.value as CommissionInvoiceInput["kind"];
              setInput({ ...input, kind });
              if (kind === "final") setAmount((available / 100).toFixed(2));
            }}
          >
            <option value="deposit">Deposit</option>
            <option value="milestone">Milestone</option>
            <option value="final">Final balance</option>
          </select>
        </label>
        <Textarea
          label="Invoice description"
          required
          minLength={3}
          maxLength={2000}
          value={input.description}
          onChange={(e) => setInput({ ...input, description: e.target.value })}
          helperText="Describe the installment and any agreed milestone. This appears on the client invoice."
        />
        <div className="field-grid">
          <Input
            label="Amount (USD)"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Due date (UTC)"
            required
            type="date"
            value={input.dueDate}
            onChange={(e) => setInput({ ...input, dueDate: e.target.value })}
          />
        </div>
        <p>
          Available for this invoice: {money(available)}. Amounts include their
          share of the agreed total; do not add tax again.
        </p>
        <Textarea
          label="Payment instructions for client"
          required
          minLength={3}
          maxLength={2000}
          value={input.paymentInstructions}
          onChange={(e) =>
            setInput({ ...input, paymentInstructions: e.target.value })
          }
          helperText="Describe the payment arrangements agreed with your client. This form does not create a payment link."
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">Save invoice draft</Button>
        {invoice && (
          <Button
            variant="secondary"
            disabled={
              JSON.stringify(input) !== JSON.stringify(invoice.input) ||
              amount !== (invoice.input.amountMinor / 100).toFixed(2)
            }
            onClick={onIssue}
          >
            Issue saved invoice
          </Button>
        )}
        {invoice && (
          <p>
            Save any edits before using Issue saved invoice. Issuing uses the
            saved document.
          </p>
        )}
      </fieldset>
    </form>
  );
}
function PaymentForm({
  outstanding,
  disabled,
  onSave,
  today,
}: {
  outstanding: number;
  disabled: boolean;
  onSave: (action: Action) => void;
  today: string;
}) {
  const [amount, setAmount] = useState(""),
    [receivedDate, setDate] = useState(today),
    [method, setMethod] = useState<
      "bank_transfer" | "cash" | "check" | "other"
    >("bank_transfer"),
    [reference, setReference] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const amountMinor = parseCommissionBudget(amount);
          if (!amountMinor)
            throw new Error("Enter a positive received amount.");
          setError("");
          onSave({
            action: "recordPayment",
            payment: { amountMinor, receivedDate, method, reference },
          });
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <fieldset className="commission-fields inv-form" disabled={disabled}>
        <legend>Record a payment received elsewhere</legend>
        <p>
          Verify the receipt before recording it. Outstanding:{" "}
          {money(outstanding)}. This action does not collect money.
        </p>
        <div className="field-grid">
          <Input
            label="Received amount (USD)"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Received date (UTC)"
            type="date"
            required
            max={today}
            value={receivedDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <label className="field">
          Payment method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="other">Other external payment</option>
          </select>
        </label>
        <Textarea
          label="Payment evidence/reference (private)"
          required
          minLength={3}
          maxLength={500}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          helperText="Use a receipt or transaction reference and where it can be verified. Do not enter card or bank credentials."
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">Record received payment</Button>
      </fieldset>
    </form>
  );
}
export function CommissionBilling({
  initial,
  canEdit,
  today,
}: {
  initial: Detail;
  canEdit: boolean;
  today: string;
}) {
  const [detail, setDetail] = useState(initial),
    [selectedId, setSelectedId] = useState(initial.invoices[0]?.id ?? ""),
    [creating, setCreating] = useState(false);
  const [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<CommissionBillingCommand | null>(null),
    [busy, setBusy] = useState(false),
    [epoch, setEpoch] = useState(0),
    [preview, setPreview] = useState<CommissionInvoice | null>(null);
  const lock = useRef(false),
    key = `sadboi-billing-pending:${detail.proposalId}`,
    path = `/api/commission-billing?proposalId=${detail.proposalId}`;
  const selected = detail.invoices.find((invoice) => invoice.id === selectedId),
    document = preview ?? selected,
    totals = commissionBillingTotals(detail.invoices, detail.source.totalMinor);
  const frozen = busy || !!pending,
    capped = detail.revision >= 200,
    canPrepare = detail.agreementState === "signed";
  function remember(command: CommissionBillingCommand | null) {
    setPending(command);
    try {
      if (command) sessionStorage.setItem(key, JSON.stringify(command));
      else sessionStorage.removeItem(key);
    } catch {
      /* In-memory recovery stays available. */
    }
  }
  function recovered() {
    try {
      const parsed = commissionBillingCommandSchema.safeParse(
        JSON.parse(sessionStorage.getItem(key) ?? "null"),
      );
      return parsed.success && parsed.data.proposalId === detail.proposalId
        ? parsed.data
        : null;
    } catch {
      return null;
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setDetail(await inventoryRequest(path));
      setEpoch((n) => n + 1);
      setPreview(null);
      setCreating(false);
      setNote("");
      setMessage("Loaded saved billing. Unsaved edits were discarded.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(command: CommissionBillingCommand) {
    const previous = recovered();
    if (previous && previous.operationId !== command.operationId) {
      setPending(previous);
      setMessage(
        "An earlier billing action needs confirmation. Retry it first.",
      );
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    remember(command);
    setMessage("");
    try {
      await inventoryRequest("/api/commission-billing", {
        method: "POST",
        body: JSON.stringify(command),
      });
      setDetail(await inventoryRequest(path));
      remember(null);
      setSelectedId(command.invoiceId);
      setCreating(false);
      setPreview(null);
      setNote("");
      setEpoch((n) => n + 1);
      setMessage(
        command.action === "issue"
          ? "Invoice issued. Share the PDF yourself; no email was sent."
          : command.action === "reversePayment"
            ? "Payment record reversed. No money was sent or refunded."
            : "Billing saved with history.",
      );
    } catch (err) {
      if (
        err instanceof InventoryRequestError &&
        [400, 403, 404, 409, 413].includes(err.status)
      )
        remember(null);
      setMessage((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function action(action: Action) {
    const parsed = commissionBillingCommandSchema.safeParse({
      ...action,
      proposalId: detail.proposalId,
      invoiceId: selectedId,
      operationId: crypto.randomUUID(),
      expectedRevision: detail.revision,
      note,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    void save(parsed.data);
  }
  return (
    <div className="commissions commission-billing proposals">
      <div className="proposal-controls">
        <PageHeading
          eyebrow="PROJECTS / INVOICES"
          title={detail.source.title}
          description="Prepare installments and track payments against the signed agreement."
        />
        <p>
          <Link href="/admin/invoices" className="inline-link">
            All commission invoices
          </Link>{" "}
          ·{" "}
          <Link
            href={`/admin/projects/agreement?proposalId=${detail.proposalId}`}
            className="inline-link"
          >
            View agreement
          </Link>{" "}
          ·{" "}
          <a href="#commission-billing" className="inline-link">
            How to manage commission invoices
          </a>
        </p>
        <p>
          {detail.source.client.name} · {detail.source.proposalNumber} · USD
        </p>
        {!canEdit && (
          <p className="notice">
            Accounting can review and print. Super admins manage invoice and
            payment records.
          </p>
        )}
        {!canPrepare && (
          <p className="notice">
            The agreement is voided. New drafts and issuing are blocked;
            existing payment records remain available for reconciliation.
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <dl className="billing-summary">
          <div>
            <dt>Agreement total</dt>
            <dd>{money(detail.source.totalMinor)}</dd>
          </div>
          <div>
            <dt>Unallocated after drafts</dt>
            <dd>{money(totals.unallocatedMinor)}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{money(totals.invoicedMinor)}</dd>
          </div>
          <div>
            <dt>Payments recorded</dt>
            <dd>{money(totals.paidMinor)}</dd>
          </div>
          <div>
            <dt>Outstanding invoices</dt>
            <dd>{money(totals.outstandingMinor)}</dd>
          </div>
          <div>
            <dt>Remaining agreement balance</dt>
            <dd>{money(totals.remainingMinor)}</dd>
          </div>
        </dl>
        <div className="inv-actions">
          <Button
            variant="secondary"
            disabled={frozen}
            onClick={() => void reload()}
          >
            Reload billing
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                disabled={frozen}
                onClick={() => {
                  const command = recovered();
                  if (command) {
                    setPending(command);
                    setMessage(
                      "Recovered action. Review and retry the original request.",
                    );
                  } else
                    setMessage(
                      "No interrupted billing action found in this browser tab.",
                    );
                }}
              >
                Recover interrupted action
              </Button>
              <Button
                disabled={
                  frozen ||
                  capped ||
                  !canPrepare ||
                  detail.invoices.length >= 20 ||
                  totals.unallocatedMinor <= 0
                }
                onClick={() => {
                  setSelectedId(crypto.randomUUID());
                  setCreating(true);
                  setPreview(null);
                  setNote("");
                }}
              >
                Add invoice
              </Button>
            </>
          )}
          {pending && (
            <Button disabled={busy} onClick={() => void save(pending)}>
              Retry same billing action
            </Button>
          )}
        </div>
        {pending && (
          <p>
            Pending action: {pending.action} · {pending.note}
          </p>
        )}
        {capped && (
          <p className="notice">
            The 200-change history limit has been reached. Ask an administrator
            to review before further work.
          </p>
        )}
        {!detail.invoices.length && (
          <p className="empty-state">
            No invoices yet. Add a deposit, milestone or final-balance draft.
          </p>
        )}
        <div className="inbox-table-wrap">
          <table className="inbox-table">
            <caption className="sr-only">Commission installments</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Type</th>
                <th scope="col">Due</th>
                <th scope="col">Amount</th>
                <th scope="col">Recorded paid</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <th scope="row">
                    <button
                      className="inbox-row-link"
                      disabled={frozen}
                      onClick={() => {
                        setSelectedId(invoice.id);
                        setCreating(false);
                        setPreview(null);
                        setNote("");
                      }}
                    >
                      {invoice.number ?? "Draft"}
                      <small>{invoice.input.title}</small>
                    </button>
                  </th>
                  <td>{invoice.input.kind}</td>
                  <td>{invoice.input.dueDate}</td>
                  <td>{money(invoice.input.amountMinor)}</td>
                  <td>{money(commissionInvoicePaid(invoice))}</td>
                  <td>
                    <span className="inbox-status">
                      {commissionInvoiceStatus(invoice, today).replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(creating || selected) && (
          <section aria-label="Selected invoice">
            <h2>{creating ? "New invoice" : selected?.input.title}</h2>
            {canEdit && !capped && (
              <Textarea
                label="Private action note"
                maxLength={2000}
                value={note}
                disabled={frozen}
                onChange={(e) => setNote(e.target.value)}
                helperText="Required for each save, issue, void, payment or correction. Explain the action for staff history; it is excluded from the PDF."
              />
            )}
            {canEdit &&
              canPrepare &&
              (creating || selected?.state === "draft") && (
                <InvoiceDraft
                  key={`${selectedId}:${detail.revision}:${epoch}`}
                  invoice={selected}
                  available={
                    totals.unallocatedMinor +
                    (selected?.state === "draft"
                      ? selected.input.amountMinor
                      : 0)
                  }
                  disabled={frozen || capped}
                  onSave={(input) => action({ action: "save", input })}
                  onIssue={() => action({ action: "issue" })}
                />
              )}
            {selected && canEdit && (
              <div className="inv-actions">
                {selected.state !== "void" &&
                  commissionInvoicePaid(selected) === 0 && (
                    <Button
                      variant="ghost"
                      disabled={frozen || capped}
                      onClick={() => action({ action: "void" })}
                    >
                      Void invoice
                    </Button>
                  )}
              </div>
            )}
            {selected?.state === "issued" &&
              canEdit &&
              commissionInvoicePaid(selected) < selected.input.amountMinor && (
                <PaymentForm
                  key={`${selectedId}:${detail.revision}`}
                  outstanding={
                    selected.input.amountMinor - commissionInvoicePaid(selected)
                  }
                  disabled={frozen || capped || selected.payments.length >= 20}
                  today={today}
                  onSave={action}
                />
              )}
            {!!selected?.payments.length && (
              <section aria-label="Payment records">
                <h3>Payment records</h3>
                <p>
                  Staff-reported receipts. Reversing a record corrects an entry;
                  it does not issue a refund.
                </p>
                {selected.payments.map((payment) => (
                  <div className="inv-panel" key={payment.id}>
                    <p>
                      {payment.receivedDate} · {money(payment.amountMinor)} ·{" "}
                      {payment.method.replaceAll("_", " ")} ·{" "}
                      {payment.reversedAt ? "Reversed" : "Recorded"}
                    </p>
                    <p className="preserve-lines">
                      Private reference: {payment.reference}
                    </p>
                    {canEdit && !payment.reversedAt && (
                      <Button
                        variant="ghost"
                        disabled={frozen || capped}
                        onClick={() =>
                          action({
                            action: "reversePayment",
                            paymentId: payment.id,
                          })
                        }
                      >
                        Reverse payment record
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            )}
          </section>
        )}
        <details>
          <summary>Billing history ({detail.history.length})</summary>
          {detail.history.map((event) => (
            <div key={event.revision} className="inv-panel">
              <p>
                Change {event.revision} · {event.action} ·{" "}
                {event.invoice.number ?? event.invoice.input.title} ·{" "}
                {event.createdAt}
              </p>
              <p className="preserve-lines">{event.note}</p>
              <Button variant="ghost" onClick={() => setPreview(event.invoice)}>
                Preview saved invoice
              </Button>
            </div>
          ))}
        </details>
        <CommissionBillingHelp />
        {document && (
          <div className="inv-actions">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Show current invoice
            </Button>
            <Button onClick={() => window.print()}>Print / save PDF</Button>
            <p>
              Prints the displayed invoice only. Turn off browser headers and
              footers to omit the private URL.
            </p>
          </div>
        )}
      </div>
      {document && (
        <CommissionInvoiceDocument
          invoice={document}
          source={detail.source}
          historical={!!preview}
          today={today}
        />
      )}
    </div>
  );
}
