"use client";
import {
  useRef,
  useState,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
  type FormEvent,
} from "react";
import {
  InventoryRequestError,
  inventoryRequest,
} from "@/lib/inventory-client";
import { Button, Input, Textarea } from "./ui";
export { Input, Textarea };
export const usd = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
export const value = (data: FormData, name: string) =>
  String(data.get(name) ?? "");
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select {...props} id={id}>
        {children}
      </select>
    </div>
  );
}
export function Status({ initial = "active" }: { initial?: string }) {
  return (
    <Select name="status" label="Status" defaultValue={initial}>
      <option value="active">Active</option>
      <option value="archived">Archived</option>
    </Select>
  );
}
export function InventoryForm({
  action,
  record,
  prepare,
  onSaved,
  children,
  label = "Save",
  again = true,
  endpoint = "/api/inventory",
  successMessage = "Saved to shared inventory.",
  disabled = false,
}: {
  action: string;
  record?: { id: string; revision: number };
  prepare: (data: FormData) => unknown;
  onSaved: (id: string) => Promise<void> | void;
  children: ReactNode;
  label?: string;
  again?: boolean;
  endpoint?: string;
  successMessage?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [generation, setGeneration] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef<{
    fingerprint: string;
    id: string;
    action: string;
    method: string;
    endpoint: string;
  } | null>(null);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    let attempted = false,
      confirmed = false;
    try {
      if (!uncertain) {
        const input = prepare(data),
          body = {
            input,
            ...(record ? { id: record.id, revision: record.revision } : {}),
          };
        const fingerprint = JSON.stringify(body);
        if (
          operation.current?.fingerprint !== fingerprint ||
          operation.current.action !== action ||
          operation.current.endpoint !== endpoint
        )
          operation.current = {
            fingerprint,
            id: crypto.randomUUID(),
            action,
            method: record ? "PATCH" : "POST",
            endpoint,
          };
      }
      const pending = operation.current!;
      attempted = true;
      const result = await inventoryRequest(
        pending.endpoint + "?action=" + pending.action,
        {
          method: pending.method,
          body: JSON.stringify({
            ...JSON.parse(pending.fingerprint),
            operationId: pending.id,
          }),
        },
      );
      confirmed = true;
      setUncertain(false);
      setSaved(true);
      await onSaved(result.id);
    } catch (error) {
      setUncertain(
        attempted &&
          !confirmed &&
          !!operation.current &&
          !(error instanceof InventoryRequestError && error.status < 500),
      );
      setError(
        error instanceof Error ? error.message : "Could not save inventory.",
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <form className="inv-form" onSubmit={submit}>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {uncertain && (
        <p className="notice">
          The save could not be confirmed. Keep this form open and retry to
          check the same entry without recording it twice.
        </p>
      )}
      {saved ? (
        <div className="inv-success" role="status">
          <p>{successMessage}</p>
          {again && (
            <Button
              variant="secondary"
              onClick={() => {
                operation.current = null;
                setSaved(false);
                setError("");
                setGeneration((n) => n + 1);
              }}
            >
              New entry
            </Button>
          )}
        </div>
      ) : (
        <>
          <fieldset disabled={busy || uncertain} key={generation}>
            <div className="inv-fields">{children}</div>
          </fieldset>
          <Button type="submit" loading={busy} disabled={disabled}>
            {uncertain ? "Retry same entry" : label}
          </Button>
        </>
      )}
    </form>
  );
}
