"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  invoiceIssueProblems,
  studioInvoiceCommandSchema,
  studioInvoiceInputSchema,
  studioInvoicePaid,
  studioInvoiceTotals,
  type StudioInvoice,
  type StudioInvoiceInput,
  type StudioInvoiceCommand,
} from "@sadboi/core";
import type { studioInvoiceDetail } from "@/server/studio-invoices";
import {
  inventoryRequest,
  InventoryRequestError,
} from "@/lib/inventory-client";
import { InvoiceMoneyField } from "./invoice-fields";
import { StudioInvoiceDocument, invoiceMoney } from "./studio-invoice-document";
import { Button, Input, Textarea, PageHeading } from "./ui";

type Detail = Awaited<ReturnType<typeof studioInvoiceDetail>>;
type Action =
  | { action: "save"; input: StudioInvoiceInput }
  | { action: "issue" | "void" }
  | {
      action: "recordPayment";
      payment: Extract<
        StudioInvoiceCommand,
        { action: "recordPayment" }
      >["payment"];
    }
  | { action: "reversePayment"; paymentId: string };
export function StudioInvoiceEditor({
  id,
  initial,
  initialInput,
  contacts,
  canEdit,
  today,
}: {
  id: string;
  initial: Detail | null;
  initialInput: StudioInvoiceInput;
  contacts: { id: string; name: string; email: string }[];
  canEdit: boolean;
  today: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial),
    [input, setInput] = useState(initialInput),
    [editing, setEditing] = useState(!initial);
  const [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [pending, setPending] = useState<StudioInvoiceCommand | null>(null);
  const lock = useRef(false);
  const storageKey = `sadboi-studio-invoice:${initial ? id : "new"}`;
  const invoice = detail?.invoice;
  const dirty =
    !invoice || JSON.stringify(input) !== JSON.stringify(invoice.input);
  const disabled = busy || !!pending || !ready;
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        const parsed = raw
          ? studioInvoiceCommandSchema.safeParse(JSON.parse(raw))
          : null;
        if (parsed?.success && (!initial || parsed.data.invoiceId === id))
          setPending(parsed.data);
      } catch {
        /* The in-memory retry remains available if storage is disabled. */
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey, id, initial]);
  const change = <K extends keyof StudioInvoiceInput>(
    key: K,
    value: StudioInvoiceInput[K],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  function forgetPending() {
    setPending(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* optional recovery storage */
    }
  }
  async function execute(command: StudioInvoiceCommand) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setPending(command);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
    } catch {
      /* in-memory retry */
    }
    try {
      await inventoryRequest("/api/invoices", {
        method: "POST",
        body: JSON.stringify(command),
      });
      const result = (await inventoryRequest(
        `/api/invoices?id=${command.invoiceId}`,
      )) as Detail;
      setDetail(result);
      setInput(result.invoice.input);
      setEditing(false);
      setNote("");
      forgetPending();
      setMessage(
        command.action === "issue"
          ? "Invoice issued. Nothing was sent to the client."
          : "Invoice updated.",
      );
      if (!initial) router.replace(`/admin/invoices/${command.invoiceId}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to confirm the result. Retry the same action below.",
      );
      if (
        error instanceof InventoryRequestError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      )
        forgetPending();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function act(action: Action) {
    if (disabled) return;
    const parsed = studioInvoiceCommandSchema.safeParse({
      ...action,
      invoiceId: invoice?.id ?? id,
      expectedRevision: invoice?.revision ?? 0,
      operationId: crypto.randomUUID(),
      note,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" "),
      );
      return;
    }
    void execute(parsed.data);
  }
  const totals = studioInvoiceTotals(input);
  const preview: StudioInvoice = invoice ?? {
    id,
    revision: 1,
    input,
    state: "draft",
    number: null,
    createdAt: `${today}T00:00:00.000Z`,
    updatedAt: `${today}T00:00:00.000Z`,
    issuedAt: null,
    dueDate: null,
    payments: [],
  };
  return (
    <div className="studio-invoice-workspace">
      <PageHeading
        eyebrow="STUDIO / INVOICES"
        title={invoice?.number ?? "Invoice draft"}
        description={input.title}
      />
      <nav className="invoice-toolbar" aria-label="Invoice navigation">
        <Link href="/admin/invoices">All invoices</Link>
        {canEdit && (
          <Link href="/admin/settings/invoices">Invoice defaults</Link>
        )}
        {invoice && (
          <Link
            href={`/admin/invoices/${invoice.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="button secondary"
          >
            Print / save PDF
          </Link>
        )}
      </nav>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {pending && canEdit && (
        <section className="notice">
          <p>
            An action may have completed. Retry this same request to confirm its
            result before making another change.
          </p>
          <Button disabled={busy} onClick={() => void execute(pending)}>
            Retry {pending.action}
          </Button>
        </section>
      )}
      {!canEdit && (
        <p className="notice">
          Accounting can review and print invoices. A super admin manages
          invoices and payment records.
        </p>
      )}
      {canEdit && (invoice?.state ?? "draft") === "draft" && !editing && (
        <Button disabled={disabled} onClick={() => setEditing(true)}>
          Edit draft
        </Button>
      )}
      {canEdit && editing ? (
        <form
          className="invoice-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = studioInvoiceInputSchema.safeParse(input);
            if (!parsed.success) {
              setError(
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join(" "),
              );
              return;
            }
            act({ action: "save", input: parsed.data });
          }}
        >
          <fieldset disabled={disabled} className="invoice-panel">
            <legend>1. Invoice and recipient</legend>
            <Input
              label="Invoice title"
              required
              minLength={3}
              maxLength={200}
              value={input.title}
              onChange={(e) => change("title", e.target.value)}
            />
            <label className="field">
              Start from a contact (optional)
              <select
                value={input.billTo.contactId}
                onChange={(e) => {
                  const contact = contacts.find((c) => c.id === e.target.value);
                  change(
                    "billTo",
                    contact
                      ? {
                          ...input.billTo,
                          contactId: contact.id,
                          name: contact.name,
                          email: contact.email,
                          confirmed: false,
                        }
                      : { ...input.billTo, contactId: "", confirmed: false },
                  );
                }}
              >
                <option value="">Enter recipient directly</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="invoice-fields-grid">
              <Input
                label="Bill to"
                required
                maxLength={200}
                value={input.billTo.name}
                onChange={(e) =>
                  change("billTo", {
                    ...input.billTo,
                    name: e.target.value,
                    confirmed: false,
                  })
                }
              />
              <Input
                label="Recipient email (optional)"
                type="email"
                maxLength={254}
                value={input.billTo.email}
                onChange={(e) =>
                  change("billTo", { ...input.billTo, email: e.target.value })
                }
              />
            </div>
            <Textarea
              label="Billing address (optional)"
              rows={3}
              maxLength={1000}
              value={input.billTo.address}
              onChange={(e) =>
                change("billTo", { ...input.billTo, address: e.target.value })
              }
            />
            <label className="invoice-check">
              <input
                type="checkbox"
                checked={input.billTo.confirmed}
                onChange={(e) =>
                  change("billTo", {
                    ...input.billTo,
                    confirmed: e.target.checked,
                  })
                }
              />
              I have confirmed who is responsible for this invoice.
            </label>
            <p className="muted">
              Leave this unchecked while a name or organization is provisional.
              Contact edits do not change this invoice’s billing snapshot.
            </p>
          </fieldset>
          <fieldset disabled={disabled} className="invoice-panel">
            <legend>2. Artwork, services and charges · USD</legend>
            {input.lines.map((line, index) => (
              <div className="invoice-line-editor" key={index}>
                <Textarea
                  label={`Item ${index + 1} description`}
                  rows={2}
                  required
                  maxLength={500}
                  value={line.description}
                  onChange={(e) =>
                    change(
                      "lines",
                      input.lines.map((row, i) =>
                        i === index
                          ? { ...row, description: e.target.value }
                          : row,
                      ),
                    )
                  }
                />
                <Input
                  label="Quantity"
                  type="number"
                  required
                  min={1}
                  max={10000}
                  step={1}
                  value={line.quantity}
                  onChange={(e) =>
                    change(
                      "lines",
                      input.lines.map((row, i) =>
                        i === index
                          ? { ...row, quantity: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
                <InvoiceMoneyField
                  key={`${index}:${input.lines.length}`}
                  label="Unit price (USD)"
                  value={line.unitMinor}
                  onChange={(value) =>
                    change(
                      "lines",
                      input.lines.map((row, i) =>
                        i === index ? { ...row, unitMinor: value } : row,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  disabled={input.lines.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() =>
                    change(
                      "lines",
                      input.lines.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={input.lines.length >= 30}
              onClick={() =>
                change("lines", [
                  ...input.lines,
                  { description: "", quantity: 1, unitMinor: 0 },
                ])
              }
            >
              Add item
            </Button>
            <div className="invoice-fields-grid">
              <InvoiceMoneyField
                label="Discount (USD)"
                value={input.discountMinor}
                onChange={(value) => change("discountMinor", value)}
              />
              <label className="field">
                Tax treatment
                <select
                  value={input.taxStatus}
                  onChange={(e) => {
                    change(
                      "taxStatus",
                      e.target.value as StudioInvoiceInput["taxStatus"],
                    );
                    if (e.target.value !== "calculated") change("taxMinor", 0);
                  }}
                >
                  <option value="unresolved">Needs review</option>
                  <option value="not_applicable">
                    Not applicable — confirmed
                  </option>
                  <option value="calculated">Calculated externally</option>
                </select>
              </label>
            </div>
            {input.taxStatus === "calculated" && (
              <InvoiceMoneyField
                label="Calculated tax (USD)"
                value={input.taxMinor}
                onChange={(value) => change("taxMinor", value)}
              />
            )}
            <Textarea
              label="Tax explanation"
              rows={2}
              maxLength={2000}
              value={input.taxNote}
              onChange={(e) => change("taxNote", e.target.value)}
            />
            <p className="muted">
              Tax is not calculated automatically. Confirm the treatment for
              this transaction before issuing; an unknown amount is not treated
              as tax-free.
            </p>
            <p className="invoice-amount">
              Subtotal {invoiceMoney(totals.subtotalMinor)} ·{" "}
              {input.taxStatus === "unresolved" ? "Before tax" : "Total"}{" "}
              {invoiceMoney(totals.totalMinor)}
            </p>
          </fieldset>
          <fieldset disabled={disabled} className="invoice-panel">
            <legend>3. Payment and studio details</legend>
            <div className="invoice-fields-grid">
              <Input
                label="Days to pay after issue"
                type="number"
                required
                min={0}
                max={365}
                value={input.dueDays}
                onChange={(e) => change("dueDays", Number(e.target.value))}
              />
              <label className="field">
                Payment method
                <select
                  value={input.paymentMethod}
                  onChange={(e) => {
                    change(
                      "paymentMethod",
                      e.target.value as StudioInvoiceInput["paymentMethod"],
                    );
                    if (e.target.value !== "stripe")
                      change("stripePaymentUrl", "");
                  }}
                >
                  <option value="stripe">Stripe payment link</option>
                  <option value="other">Other / manual instructions</option>
                </select>
              </label>
            </div>
            {input.paymentMethod === "stripe" && (
              <Input
                label="Stripe payment link"
                type="url"
                maxLength={2000}
                placeholder="https://buy.stripe.com/…"
                value={input.stripePaymentUrl}
                onChange={(e) => change("stripePaymentUrl", e.target.value)}
                helperText="Paste the link created in your Stripe account. Verify its amount, currency and intended recipient. This app does not create or monitor Stripe payments."
              />
            )}
            <Textarea
              label="Payment instructions"
              rows={3}
              maxLength={2000}
              value={input.paymentInstructions}
              onChange={(e) => change("paymentInstructions", e.target.value)}
            />
            <div className="invoice-fields-grid">
              <Input
                label="Studio / billing name"
                required
                maxLength={200}
                value={input.issuer.name}
                onChange={(e) =>
                  change("issuer", { ...input.issuer, name: e.target.value })
                }
              />
              <Input
                label="Studio billing email"
                type="email"
                maxLength={254}
                value={input.issuer.email}
                onChange={(e) =>
                  change("issuer", { ...input.issuer, email: e.target.value })
                }
              />
            </div>
            <Textarea
              label="Studio billing address"
              rows={3}
              maxLength={1000}
              value={input.issuer.address}
              onChange={(e) =>
                change("issuer", { ...input.issuer, address: e.target.value })
              }
            />
          </fieldset>
          <fieldset disabled={disabled} className="invoice-panel">
            <legend>4. Usage and agreements</legend>
            <Input
              label="Existing agreement reference (optional)"
              maxLength={500}
              value={input.agreementReference}
              onChange={(e) => change("agreementReference", e.target.value)}
              helperText="For example: agreement title and date. This is a reference, not a new signature or a synchronized billing allocation."
            />
            <label className="field">
              Usage terms status
              <select
                value={input.usage.status}
                onChange={(e) => {
                  const status = e.target
                    .value as StudioInvoiceInput["usage"]["status"];
                  change("usage", {
                    status,
                    text: status === "none" ? "" : input.usage.text,
                    acceptanceReference:
                      status === "agreed"
                        ? input.usage.acceptanceReference
                        : "",
                  });
                }}
              >
                <option value="none">No usage language on this invoice</option>
                <option value="proposed">
                  Proposed — awaiting client approval
                </option>
                <option value="agreed">
                  Client has agreed — record evidence
                </option>
              </select>
            </label>
            {input.usage.status !== "none" && (
              <Textarea
                label="Usage / licensing language shown to the client"
                rows={6}
                required
                maxLength={6000}
                value={input.usage.text}
                onChange={(e) =>
                  change("usage", {
                    ...input.usage,
                    text: e.target.value,
                    status: "proposed",
                    acceptanceReference: "",
                  })
                }
              />
            )}
            {input.usage.status === "agreed" && (
              <Textarea
                label="Private acceptance reference"
                rows={3}
                required
                minLength={3}
                maxLength={2000}
                value={input.usage.acceptanceReference}
                onChange={(e) =>
                  change("usage", {
                    ...input.usage,
                    acceptanceReference: e.target.value,
                  })
                }
              />
            )}
            <p className="muted">
              Changing the wording returns it to proposed. Record who agreed,
              when, and where the approval is saved before marking it agreed.
              Issuing an invoice does not record a signature. Use Agreements for
              the existing proposal signing workflow.
            </p>
            <Textarea
              label="Client-facing notes"
              rows={3}
              maxLength={3000}
              value={input.notes}
              onChange={(e) => change("notes", e.target.value)}
            />
          </fieldset>
          <Textarea
            label="Private change note"
            rows={2}
            required
            minLength={3}
            maxLength={2000}
            value={note}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="invoice-toolbar">
            <Button type="submit" disabled={disabled || !dirty}>
              Save draft
            </Button>
            {invoice && (
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setInput(invoice.input);
                  setEditing(false);
                  setError("");
                }}
              >
                Cancel edit
              </Button>
            )}
          </div>
          <details>
            <summary>Preview unsaved draft</summary>
            <StudioInvoiceDocument
              invoice={{ ...preview, input }}
              today={today}
            />
          </details>
        </form>
      ) : (
        <StudioInvoiceDocument invoice={preview} today={today} />
      )}
      {canEdit && invoice && !editing && (
        <section className="invoice-panel">
          <h2>Manage invoice</h2>
          <Textarea
            label="Private action note"
            rows={2}
            maxLength={2000}
            disabled={disabled}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {invoice.state === "draft" && (
            <>
              {!!invoiceIssueProblems(invoice.input).length && (
                <div className="notice">
                  <p>Before issuing:</p>
                  <ul>
                    {invoiceIssueProblems(invoice.input).map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                Issue freezes the saved details and sets the due date. Numbers
                use the draft’s last saved date in Chicago time, the first three
                letters of the billed-to name, and a sequence: YYMMDD-NAM-001.
                Nothing is emailed and no Stripe invoice is created.
              </p>
              <Button
                disabled={
                  disabled ||
                  note.trim().length < 3 ||
                  !!invoiceIssueProblems(invoice.input).length
                }
                onClick={() => act({ action: "issue" })}
              >
                Issue invoice
              </Button>
            </>
          )}
          {invoice.state !== "void" && (
            <details>
              <summary>Void this invoice</summary>
              <p>
                This retains the history and does not issue a refund. Only
                unpaid invoices can be voided.
              </p>
              <Button
                variant="secondary"
                disabled={
                  disabled ||
                  note.trim().length < 3 ||
                  studioInvoicePaid(invoice) > 0
                }
                onClick={() => act({ action: "void" })}
              >
                Confirm void
              </Button>
            </details>
          )}
          {invoice.state === "issued" && (
            <details>
              <summary>Record a received payment</summary>
              <p>
                Check Stripe or your bank first. This records money already
                received; it does not charge the client.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  act({
                    action: "recordPayment",
                    payment: {
                      amountMinor: Math.round(
                        Number(fields.get("amount")) * 100,
                      ),
                      receivedDate: String(fields.get("date")),
                      method: String(fields.get("method")) as "stripe",
                      reference: String(fields.get("reference")),
                    },
                  });
                }}
              >
                <fieldset
                  disabled={disabled}
                  className="invoice-payment-fields"
                >
                  <Input
                    name="amount"
                    label="Received amount (USD)"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    max={
                      (studioInvoiceTotals(invoice.input).totalMinor -
                        studioInvoicePaid(invoice)) /
                      100
                    }
                  />
                  <Input
                    name="date"
                    label="Received date"
                    type="date"
                    required
                    max={today}
                    defaultValue={today}
                  />
                  <label className="field">
                    Method
                    <select
                      name="method"
                      defaultValue={
                        invoice.input.paymentMethod === "stripe"
                          ? "stripe"
                          : "bank_transfer"
                      }
                    >
                      {[
                        "stripe",
                        "bank_transfer",
                        "cash",
                        "check",
                        "other",
                      ].map((method) => (
                        <option key={method} value={method}>
                          {method.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    name="reference"
                    label="Private payment reference"
                    required
                    minLength={3}
                    maxLength={500}
                  />
                  <Button type="submit" disabled={note.trim().length < 3}>
                    Record payment
                  </Button>
                </fieldset>
              </form>
            </details>
          )}
        </section>
      )}
      {!!invoice?.payments.length && (
        <section className="invoice-panel">
          <h2>Payment records</h2>
          <div className="inbox-table-wrap">
            <table className="inbox-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method / private reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receivedDate}</td>
                    <td>{invoiceMoney(payment.amountMinor)}</td>
                    <td>
                      {payment.method.replaceAll("_", " ")}
                      <small>{payment.reference}</small>
                    </td>
                    <td>
                      {payment.reversedAt ? "Reversed" : "Recorded"}
                      {canEdit && !payment.reversedAt && (
                        <Button
                          variant="ghost"
                          disabled={
                            disabled || note.trim().length < 3 || editing
                          }
                          onClick={() =>
                            act({
                              action: "reversePayment",
                              paymentId: payment.id,
                            })
                          }
                        >
                          Reverse record
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Reversing corrects a record; it does not refund money. Add a private
            action note above before reversing.
          </p>
        </section>
      )}
      {!!detail?.history.length && (
        <details className="invoice-panel">
          <summary>Private change history ({detail.history.length})</summary>
          <ol>
            {detail.history.map((row) => (
              <li key={row.revision}>
                <strong>
                  {row.action} · {row.createdAt}
                </strong>
                <p className="preserve-lines">{row.note}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
