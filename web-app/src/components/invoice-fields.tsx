"use client";
import { useState } from "react";
import type { InvoiceDefaults } from "@sadboi/core";
import { Input, Textarea } from "./ui";

export function InvoiceMoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (minor: number) => void;
}) {
  const [raw, setRaw] = useState((value / 100).toFixed(2));
  return (
    <Input
      label={label}
      type="number"
      required
      min="0"
      max="1000000"
      step="0.01"
      value={raw}
      onChange={(event) => {
        setRaw(event.target.value);
        if (event.target.validity.valid)
          onChange(Math.round(Number(event.target.value) * 100));
      }}
    />
  );
}
export function InvoiceDefaultFields({
  input,
  onChange,
}: {
  input: InvoiceDefaults;
  onChange: (value: InvoiceDefaults) => void;
}) {
  const change = <K extends keyof InvoiceDefaults>(
    key: K,
    value: InvoiceDefaults[K],
  ) => onChange({ ...input, [key]: value });
  return (
    <>
      <h2>Studio billing details</h2>
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
          label="Billing email"
          type="email"
          maxLength={254}
          value={input.issuer.email}
          onChange={(e) =>
            change("issuer", { ...input.issuer, email: e.target.value })
          }
        />
      </div>
      <Textarea
        label="Billing address"
        rows={3}
        maxLength={1000}
        value={input.issuer.address}
        onChange={(e) =>
          change("issuer", { ...input.issuer, address: e.target.value })
        }
      />
      <h2>Payment defaults</h2>
      <div className="invoice-fields-grid">
        <Input
          label="Days to pay after issue"
          type="number"
          required
          min={0}
          max={365}
          value={input.dueDays}
          onChange={(e) => change("dueDays", Number(e.target.value))}
          helperText="30 means payment is due 30 calendar days after the invoice is issued. 0 means due on issue."
        />
        <label className="field">
          Payment method
          <select
            value={input.paymentMethod}
            onChange={(e) =>
              change(
                "paymentMethod",
                e.target.value as InvoiceDefaults["paymentMethod"],
              )
            }
          >
            <option value="stripe">Stripe payment link</option>
            <option value="other">Other / manual instructions</option>
          </select>
        </label>
      </div>
      <Textarea
        label="Payment instructions"
        rows={3}
        maxLength={2000}
        value={input.paymentInstructions}
        onChange={(e) => change("paymentInstructions", e.target.value)}
      />
      <p className="muted">
        Add an invoice-specific Stripe link on each draft. This generator does
        not create Stripe invoices, collect money, or monitor payments.
      </p>
      <Textarea
        label="Default client-facing notes"
        rows={3}
        maxLength={3000}
        value={input.notes}
        onChange={(e) => change("notes", e.target.value)}
      />
      <Textarea
        label="Reusable usage / licensing language"
        rows={6}
        maxLength={6000}
        value={input.usageTemplate}
        onChange={(e) => change("usageTemplate", e.target.value)}
      />
      <p className="muted">
        Copied to new invoices as proposed terms. Tailor the artwork, permitted
        products, and any other scope to each job. Saving a template does not
        record client acceptance.
      </p>
    </>
  );
}
