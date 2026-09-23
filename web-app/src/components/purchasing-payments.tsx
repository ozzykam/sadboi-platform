"use client";
import { useState } from "react";
import type {
  FinanceCatalog,
  PaymentCatalog,
  RefundCatalog,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value, usd } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
export function PurchasingPayments({
  initial,
  finance,
  canEdit,
  onChanged,
}: {
  initial: PaymentCatalog;
  finance: FinanceCatalog;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState(initial),
    [refunds, setRefunds] = useState<RefundCatalog>({ refunds: [] }),
    [editing, setEditing] = useState(false),
    [refundEditing, setRefundEditing] = useState(false);
  async function refresh() {
    const [payments, refundPage] = await Promise.all([
      inventoryRequest("/api/purchasing?payments=1"),
      inventoryRequest("/api/purchasing?refunds=1"),
    ]);
    setCatalog(payments);
    setRefunds(refundPage);
    await onChanged();
  }
  if (editing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>Record payment attempt</h2>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Close editor
          </Button>
        </div>
        <InventoryForm
          endpoint="/api/purchasing"
          action="payment"
          label="Save payment record"
          successMessage="Payment record saved."
          again={false}
          onSaved={async () => {
            setEditing(false);
            await refresh();
          }}
          prepare={(data) => ({
            billId: value(data, "billId"),
            amountMinor: Math.round(Number(value(data, "amount")) * 100),
            method: value(data, "method"),
            reference: value(data, "reference"),
            status: value(data, "status"),
            paymentDate: value(data, "paymentDate"),
            notes: value(data, "notes"),
          })}
        >
          <Select label="Vendor bill" name="billId" required>
            <option value="">Choose bill</option>
            {finance.bills
              .filter((bill) => ["approved", "received"].includes(bill.status))
              .map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.invoiceNumber} · {bill.supplierName} ·{" "}
                  {usd(bill.totalMinor)}
                </option>
              ))}
          </Select>
          <Input
            label="Amount (USD)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
          <Select label="Method" name="method" required>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Payment date" name="paymentDate" type="date" required />
          <Input label="Reference" name="reference" maxLength={160} />
          <Select
            label="Status"
            name="status"
            required
            defaultValue="attempted"
          >
            <option value="attempted">Attempted</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
            <option value="void">Void</option>
          </Select>
          <Input label="Notes" name="notes" maxLength={2000} />
        </InventoryForm>
      </section>
    );
  if (refundEditing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>Record refund</h2>
          <Button variant="ghost" onClick={() => setRefundEditing(false)}>
            Close editor
          </Button>
        </div>
        <InventoryForm
          endpoint="/api/purchasing"
          action="refund"
          label="Save refund"
          successMessage="Refund saved."
          again={false}
          onSaved={async () => {
            setRefundEditing(false);
            await refresh();
          }}
          prepare={(data) => ({
            paymentId: value(data, "paymentId"),
            amountMinor: Math.round(Number(value(data, "amount")) * 100),
            reason: value(data, "reason"),
            status: value(data, "status"),
            refundDate: value(data, "refundDate"),
            reference: value(data, "reference"),
          })}
        >
          <Select label="Settled payment" name="paymentId" required>
            <option value="">Choose payment</option>
            {catalog.payments
              .filter((payment) => payment.status === "settled")
              .map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.invoiceNumber} · {usd(payment.amountMinor)}
                </option>
              ))}
          </Select>
          <Input
            label="Refund amount (USD)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
          <Input
            label="Reason"
            name="reason"
            required
            minLength={3}
            maxLength={2000}
          />
          <Input label="Refund date" name="refundDate" type="date" required />
          <Input label="Reference" name="reference" maxLength={160} />
          <Select
            label="Status"
            name="status"
            required
            defaultValue="requested"
          >
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="settled">Settled</option>
            <option value="rejected">Rejected</option>
          </Select>
        </InventoryForm>
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Payments</h2>
          <p className="inv-description">
            Record attempts and settlements separately from journal entries.
          </p>
        </div>
        {canEdit && (
          <>
            <Button onClick={() => setEditing(true)}>Record payment</Button>
            <Button variant="secondary" onClick={() => setRefundEditing(true)}>
              Record refund
            </Button>
          </>
        )}
      </div>
      <Button variant="secondary" onClick={refresh}>
        Refresh payments
      </Button>
      {!catalog.payments.length && (
        <p className="empty-state">No payments recorded yet.</p>
      )}
      <div className="inv-cards">
        {catalog.payments.map((payment) => (
          <article className="inv-panel" key={payment.id}>
            <Badge
              tone={
                payment.status === "settled"
                  ? "green"
                  : payment.status === "failed" || payment.status === "void"
                    ? "red"
                    : "gold"
              }
            >
              {payment.status}
            </Badge>
            <h3>
              {payment.invoiceNumber} · {payment.supplierName}
            </h3>
            <p>
              {usd(payment.amountMinor)} · {payment.method} ·{" "}
              {payment.paymentDate}
            </p>
            {payment.reference && (
              <p className="field-hint">Reference: {payment.reference}</p>
            )}
            {payment.notes && <p className="preserve-lines">{payment.notes}</p>}
          </article>
        ))}
      </div>
      {refunds.refunds.length > 0 && (
        <>
          <h3>Refund history</h3>
          <div className="inv-cards">
            {refunds.refunds.map((refund) => (
              <article className="inv-panel" key={refund.id}>
                <Badge>{refund.status}</Badge>
                <p>
                  {refund.invoiceNumber} · {usd(refund.amountMinor)} ·{" "}
                  {refund.reason}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
