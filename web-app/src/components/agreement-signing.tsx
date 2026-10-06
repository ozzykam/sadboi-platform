"use client";
import { useRef, useState } from "react";
import {
  agreementAccessSchema,
  agreementConsent,
  type AgreementAccess,
} from "@sadboi/core";
import {
  AgreementDocument,
  type AgreementDocumentRecord,
} from "./agreement-document";
import { Button, Input } from "./ui";
type Signature = Extract<AgreementAccess, { action: "sign" }>;
export function AgreementSigning() {
  const [record, setRecord] = useState<AgreementDocumentRecord | null>(null),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Signature | null>(null);
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [consent, setConsent] = useState(false);
  const access = useRef<{ proposalId: string; token: string } | null>(null),
    lock = useRef(false);
  const key = () =>
    `sadboi-signature:${access.current?.proposalId}:${access.current?.token}`;
  async function request(command: AgreementAccess) {
    const response = await fetch("/api/agreement-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.error ?? "Unable to access agreement."),
        { status: response.status },
      );
    return data as AgreementDocumentRecord;
  }
  async function load() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const [proposalId, token] = window.location.hash.slice(1).split(".");
      const parsed = agreementAccessSchema.safeParse({
        action: "read",
        proposalId,
        token,
      });
      if (!parsed.success)
        throw new Error(
          "Open the complete private link provided by the studio.",
        );
      access.current = { proposalId, token };
      const next = await request(parsed.data);
      setRecord(next);
      setConsent(false);
      try {
        const saved = agreementAccessSchema.safeParse(
          JSON.parse(sessionStorage.getItem(key()) ?? "null"),
        );
        if (
          saved.success &&
          saved.data.action === "sign" &&
          saved.data.proposalId === proposalId &&
          saved.data.token === token
        ) {
          setPending(saved.data);
          setMessage(
            "An interrupted signature was found. Retry the same signature to confirm the result.",
          );
        }
      } catch {
        /* The server retains completed signatures. */
      }
    } catch (error) {
      setRecord(null);
      setMessage(
        error instanceof Error ? error.message : "Unable to load agreement.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function sign(command: Signature) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPending(command);
    setMessage("");
    try {
      sessionStorage.setItem(key(), JSON.stringify(command));
    } catch {
      /* Same-page retry still works. */
    }
    try {
      setRecord(await request(command));
      setPending(null);
      try {
        sessionStorage.removeItem(key());
      } catch {
        /* No new signature can overwrite the saved one. */
      }
      setMessage(
        "Your signature has been recorded. You can print or save a copy below.",
      );
    } catch (error) {
      if (
        [400, 403, 404, 409, 413].includes(
          (error as { status?: number }).status ?? 0,
        )
      ) {
        setPending(null);
        setRecord(null);
        try {
          sessionStorage.removeItem(key());
        } catch {
          /* Best effort cleanup. */
        }
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "Result unknown. Retry the same signature.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="agreement-signing agreements">
      <div className="agreement-controls">
        <h1>Review your agreement</h1>
        <p>
          Load the private invitation, review the agreement and attached
          proposal, then enter your name and signing date.
        </p>
        <Button disabled={busy || !!pending} onClick={() => void load()}>
          Load agreement
        </Button>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {pending && (
          <Button disabled={busy} onClick={() => void sign(pending)}>
            Retry same signature
          </Button>
        )}
        {record && (
          <p>
            Private link expires {record.invitationExpiresAt}. Keep the link
            private.
          </p>
        )}
      </div>
      {record && <AgreementDocument record={record} />}
      {record && (
        <div className="agreement-controls">
          {record.state === "invited" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!access.current || pending || busy) return;
                const parsed = agreementAccessSchema.safeParse({
                  ...access.current,
                  action: "sign",
                  operationId: crypto.randomUUID(),
                  expectedRevision: record.revision,
                  documentHash: record.documentHash,
                  signerName: name,
                  signedDate: date,
                  consent,
                });
                if (!parsed.success || parsed.data.action !== "sign") {
                  setMessage("Enter your full name, signing date and consent.");
                  return;
                }
                void sign(parsed.data);
              }}
            >
              <fieldset
                className="commission-fields inv-form"
                disabled={busy || !!pending}
              >
                <legend>Sign agreement</legend>
                <Input
                  label="Full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Declared signing date"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <label className="contact-consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>{agreementConsent}</span>
                </label>
                <Button type="submit">Sign agreement</Button>
              </fieldset>
            </form>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            Print / save PDF
          </Button>
          <p>
            Turn off browser headers and footers before saving a copy to omit
            the private link.
          </p>
        </div>
      )}
    </main>
  );
}
