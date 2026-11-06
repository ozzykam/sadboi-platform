"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { invoiceDefaultsSaveSchema } from "@sadboi/core";
import type { InvoiceDefaultsRecord } from "@/server/studio-invoices";
import { inventoryRequest } from "@/lib/inventory-client";
import { InvoiceDefaultFields } from "./invoice-fields";
import { Button, PageHeading } from "./ui";
export function InvoiceDefaultsEditor({
  initial,
}: {
  initial: InvoiceDefaultsRecord;
}) {
  const [saved, setSaved] = useState(initial),
    [input, setInput] = useState(initial.input);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const attempt = useRef<{ fingerprint: string; operationId: string } | null>(
    null,
  );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const body = { input, expectedRevision: saved.revision },
      fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, operationId: crypto.randomUUID() };
    const parsed = invoiceDefaultsSaveSchema.safeParse({
      ...body,
      operationId: attempt.current.operationId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setBusy(true);
    try {
      const result = (await inventoryRequest("/api/invoice-defaults", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      })) as InvoiceDefaultsRecord;
      setSaved(result);
      setInput(result.input);
      attempt.current = null;
      setMessage("Defaults saved. Existing invoices have not changed.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save defaults.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="STUDIO / SETTINGS"
        title="Invoice defaults"
        description="Reusable starting points for new standalone invoices. Each invoice keeps its own copy."
      />
      <Link href="/admin/invoices">Back to invoices</Link>
      <form className="invoice-editor" onSubmit={save}>
        <fieldset disabled={busy} className="invoice-panel">
          <InvoiceDefaultFields input={input} onChange={setInput} />
        </fieldset>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <Button
          type="submit"
          loading={busy}
          disabled={JSON.stringify(input) === JSON.stringify(saved.input)}
        >
          Save defaults
        </Button>
      </form>
    </>
  );
}
