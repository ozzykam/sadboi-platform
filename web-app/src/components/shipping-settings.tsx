"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { usShippingRegions, type ShippingSettings, type ShippingPolicy } from "@sadboi/core";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input } from "./ui";

export function ShippingSettingsEditor({ initial, canEdit }: { initial: ShippingSettings; canEdit: boolean }) {
  const [saved, setSaved] = useState(initial), [input, setInput] = useState(initial.input);
  const [amounts, setAmounts] = useState({ standard: (initial.input.standard.amountMinor / 100).toFixed(2), express: (initial.input.express.amountMinor / 100).toFixed(2) });
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false), [message, setMessage] = useState("");
  const attempt = useRef<{ operationId: string; expectedRevision: number; input: ShippingPolicy } | null>(null), lock = useRef(false);
  function load(value: ShippingSettings) { setSaved(value); setInput(value.input); setAmounts({ standard: (value.input.standard.amountMinor / 100).toFixed(2), express: (value.input.express.amountMinor / 100).toFixed(2) }); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || !canEdit || conflict) return;
    if (!attempt.current) {
      if (Object.values(amounts).some(value => !/^\d{1,5}(?:\.\d{1,2})?$/.test(value))) { setMessage("Enter each rate in dollars with at most two decimal places."); return; }
      const cents = (value: string) => { const [dollars, fraction = ""] = value.split("."); return Number(dollars) * 100 + Number(fraction.padEnd(2, "0")); };
      attempt.current = { operationId: crypto.randomUUID(), expectedRevision: saved.revision, input: { ...input,
        standard: { ...input.standard, amountMinor: cents(amounts.standard) }, express: { ...input.express, amountMinor: cents(amounts.express) } } };
    }
    lock.current = true; setBusy(true); setMessage("");
    try {
      load(await inventoryRequest("/api/store/shipping", { method: "POST", body: JSON.stringify(attempt.current) }));
      attempt.current = null; setUncertain(false); setMessage("Shipping rates saved. Existing orders keep their original charges.");
    } catch (error) {
      if (error instanceof InventoryRequestError && error.status >= 400 && error.status < 500) { attempt.current = null; setUncertain(false); setConflict(error.status === 409); }
      else setUncertain(true);
      setMessage(error instanceof Error ? error.message : "The save result is unknown. Retry the same save.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className="inv-panel shipping-settings">
    <h1>Shipping rates</h1>
    <p>Set a flat charge per order for US destinations. Studio pickup is always free. No live carrier prices, labels, delivery estimates or tax calculations are provided.</p>
    <p>These settings currently apply to test checkout. Shipping stays unavailable until a service and its destination states are enabled.</p>
    <Link href="/admin/how-to#shipping-rates" className="inline-link">How to configure shipping rates</Link>
    {!canEdit && <p>Accounting can review these settings. A super admin makes changes.</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {uncertain && <p className="notice">Keep this page open and choose Retry same save. If you close it, inspect the saved rates before making another change.</p>}
    <form onSubmit={save} className="inv-form">
      <fieldset disabled={!canEdit || busy || uncertain || conflict} className="inv-form" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <legend>Rates and destinations</legend>
        {(["standard", "express"] as const).map(method => <div key={method}>
          <label><input type="checkbox" checked={input[method].enabled} onChange={event => setInput(value => ({ ...value, [method]: { ...value[method], enabled: event.target.checked } }))} /> Enable {method} shipping</label>
          <Input label={`${method === "standard" ? "Standard" : "Express"} rate (USD per order)`} inputMode="decimal" value={amounts[method]} onChange={event => setAmounts(value => ({ ...value, [method]: event.target.value }))} />
        </div>)}
        <p>Supported destinations: 50 US states and Washington, DC. Territories and military addresses are not supported in this version. ZIP codes are format-checked; addresses are not verified with a carrier.</p>
        <div className="inv-actions"><Button type="button" variant="secondary" onClick={() => setInput(value => ({ ...value, regions: [...usShippingRegions] }))}>Select all destinations</Button>
          <Button type="button" variant="secondary" onClick={() => setInput(value => ({ ...value, regions: [] }))}>Clear destinations</Button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: "12px" }}>
          {usShippingRegions.map(region => <label key={region}><input type="checkbox" checked={input.regions.includes(region)} onChange={event => setInput(value => ({ ...value, regions: event.target.checked ? [...value.regions, region].sort() : value.regions.filter(item => item !== region) }))} /> {region}</label>)}
        </div>
      </fieldset>
      <p>Changes apply to new order requests. Disabling a service prevents new orders from selecting it; it does not cancel or reprice saved orders.</p>
      <div className="inv-actions">
        {canEdit && <Button type="submit" loading={busy} disabled={conflict}>{uncertain ? "Retry same save" : "Save shipping rates"}</Button>}
        <Button type="button" variant="secondary" disabled={busy || uncertain} onClick={async () => {
          setBusy(true); try { load(await inventoryRequest("/api/store/shipping")); setConflict(false); setMessage("Saved shipping rates loaded. Unsaved edits were replaced."); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Rates could not load."); } finally { setBusy(false); }
        }}>Reload saved rates</Button>
      </div>
    </form>
  </section>;
}
