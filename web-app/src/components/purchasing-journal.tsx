"use client";
import { useState } from "react";
import type { FinanceCatalog, JournalCatalog } from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, value, usd } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
export function PurchasingJournal({
  initial,
  finance,
  canEdit,
  onChanged,
}: {
  initial: JournalCatalog;
  finance: FinanceCatalog;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState(initial),
    [editing, setEditing] = useState(false);
  async function refresh() {
    setCatalog(await inventoryRequest("/api/purchasing?journal=1"));
    await onChanged();
  }
  if (editing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>Post journal entry</h2>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Close editor
          </Button>
        </div>
        <InventoryForm
          endpoint="/api/purchasing"
          action="journal"
          label="Post balanced entry"
          successMessage="Journal entry posted."
          again={false}
          onSaved={async () => {
            setEditing(false);
            await refresh();
          }}
          prepare={(data) => ({
            sourceType: "vendor_bill",
            sourceId: value(data, "sourceId"),
            entryDate: value(data, "entryDate"),
            memo: value(data, "memo"),
            lines: [
              {
                account: value(data, "debitAccount"),
                debitMinor: Math.round(Number(value(data, "amount")) * 100),
                creditMinor: 0,
              },
              {
                account: value(data, "creditAccount"),
                debitMinor: 0,
                creditMinor: Math.round(Number(value(data, "amount")) * 100),
              },
            ],
          })}
        >
          <select name="sourceId" aria-label="Vendor bill source" required>
            <option value="">Choose vendor bill</option>
            {finance.bills
              .filter((bill) => bill.status !== "void")
              .map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.invoiceNumber} · {bill.supplierName} ·{" "}
                  {usd(bill.totalMinor)}
                </option>
              ))}
          </select>
          <Input label="Entry date" name="entryDate" type="date" required />
          <Input
            label="Memo"
            name="memo"
            required
            minLength={1}
            maxLength={2000}
            placeholder="Record approved supplier invoice"
          />
          <Input
            label="Debit account"
            name="debitAccount"
            required
            defaultValue="Inventory"
          />
          <Input
            label="Credit account"
            name="creditAccount"
            required
            defaultValue="Accounts payable"
          />
          <Input
            label="Amount (USD)"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
        </InventoryForm>
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Journal</h2>
          <p className="inv-description">
            Balanced double-entry records linked to source bills.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing(true)}>Post journal entry</Button>
        )}
      </div>
      <Button variant="secondary" onClick={refresh}>
        Refresh journal
      </Button>
      {!catalog.entries.length && (
        <p className="empty-state">No journal entries yet.</p>
      )}
      <div className="inv-cards">
        {catalog.entries.map((entry) => (
          <article className="inv-panel" key={entry.id}>
            <Badge>{entry.sourceType.replaceAll("_", " ")}</Badge>
            <h3>
              {usd(entry.totalMinor)} · {entry.entryDate}
            </h3>
            <p>{entry.memo}</p>
            <ul>
              {entry.lines.map((line, index) => (
                <li key={index}>
                  {line.account}:{" "}
                  {line.debitMinor
                    ? "Debit " + usd(line.debitMinor)
                    : "Credit " + usd(line.creditMinor)}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
