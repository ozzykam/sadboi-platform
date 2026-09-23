"use client";
import { useState } from "react";
import type {
  FinanceCatalog,
  PurchasingCatalog,
  VendorBillRecord,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value, usd } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
function BillEditor({
  record,
  purchasing,
  onSaved,
}: {
  record?: VendorBillRecord;
  purchasing: PurchasingCatalog;
  onSaved: () => Promise<void>;
}) {
  return (
    <InventoryForm
      endpoint="/api/purchasing"
      action="bill"
      record={record}
      label="Save vendor bill"
      successMessage="Vendor bill saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        supplierId: value(data, "supplierId"),
        purchaseOrderId: value(data, "purchaseOrderId"),
        invoiceNumber: value(data, "invoiceNumber"),
        invoiceDate: value(data, "invoiceDate"),
        dueDate: value(data, "dueDate"),
        currency: "USD",
        subtotalMinor: Math.round(Number(value(data, "subtotal")) * 100),
        shippingMinor: Math.round(Number(value(data, "shipping")) * 100),
        taxMinor: Math.round(Number(value(data, "tax")) * 100),
        status: value(data, "status"),
        notes: value(data, "notes"),
      })}
    >
      <Select
        label="Supplier"
        name="supplierId"
        required
        defaultValue={record?.supplierId ?? ""}
      >
        <option value="">Choose supplier</option>
        {purchasing.suppliers
          .filter((item) => item.status === "active")
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </Select>
      <Select
        label="Purchase order (optional)"
        name="purchaseOrderId"
        defaultValue={record?.purchaseOrderId ?? ""}
      >
        <option value="">No linked order</option>
        {purchasing.orders.map((order) => (
          <option key={order.id} value={order.id}>
            {order.number} · {order.supplier.name}
          </option>
        ))}
      </Select>
      <Input
        label="Invoice number"
        name="invoiceNumber"
        required
        maxLength={160}
        defaultValue={record?.invoiceNumber}
      />
      <Input
        label="Invoice date"
        name="invoiceDate"
        type="date"
        required
        defaultValue={record?.invoiceDate}
      />
      <Input
        label="Due date"
        name="dueDate"
        type="date"
        defaultValue={record?.dueDate}
      />
      <Input
        label="Subtotal (USD)"
        name="subtotal"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={record ? (record.subtotalMinor / 100).toFixed(2) : ""}
      />
      <Input
        label="Shipping (USD)"
        name="shipping"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={record ? (record.shippingMinor / 100).toFixed(2) : "0.00"}
      />
      <Input
        label="Tax (USD)"
        name="tax"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={record ? (record.taxMinor / 100).toFixed(2) : "0.00"}
      />
      <Select
        label="Status"
        name="status"
        required
        defaultValue={record?.status ?? "draft"}
      >
        <option value="draft">Draft</option>
        <option value="received">Received</option>
        <option value="approved">Approved</option>
        <option value="paid">Paid</option>
        <option value="void">Void</option>
      </Select>
      <Input
        label="Notes"
        name="notes"
        maxLength={2000}
        defaultValue={record?.notes}
      />
    </InventoryForm>
  );
}
export function PurchasingBills({
  initial,
  purchasing,
  canEdit,
  onChanged,
}: {
  initial: FinanceCatalog;
  purchasing: PurchasingCatalog;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState(initial),
    [editing, setEditing] = useState<string | null>(null);
  async function refresh() {
    setCatalog(await inventoryRequest("/api/purchasing?bills=1"));
    await onChanged();
  }
  async function saved() {
    setEditing(null);
    await refresh();
  }
  if (editing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>{editing === "new" ? "Add vendor bill" : "Edit vendor bill"}</h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
        <BillEditor
          record={catalog.bills.find((item) => item.id === editing)}
          purchasing={purchasing}
          onSaved={saved}
        />
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Vendor bills</h2>
          <p className="inv-description">
            Record supplier invoices separately from purchase orders and stock
            receipts.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>Add vendor bill</Button>
        )}
      </div>
      <Button variant="secondary" onClick={refresh}>
        Refresh bills
      </Button>
      {!catalog.bills.length && (
        <p className="empty-state">No vendor bills yet.</p>
      )}
      <div className="inv-cards">
        {catalog.bills.map((bill) => (
          <article className="inv-panel" key={bill.id}>
            <Badge
              tone={
                bill.status === "paid"
                  ? "green"
                  : bill.status === "void"
                    ? "red"
                    : "gold"
              }
            >
              {bill.status}
            </Badge>
            <h3>
              {bill.invoiceNumber} · {bill.supplierName}
            </h3>
            <p>
              {usd(bill.totalMinor)} total · Invoice {bill.invoiceDate}
              {bill.dueDate && " · Due " + bill.dueDate}
            </p>
            {bill.orderNumber && (
              <p className="field-hint">Linked to {bill.orderNumber}</p>
            )}
            {bill.notes && <p className="preserve-lines">{bill.notes}</p>}
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(bill.id)}>
                Edit bill
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
