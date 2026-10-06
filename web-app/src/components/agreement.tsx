"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  agreementCommandSchema,
  type AgreementCommand,
  type AgreementInput,
} from "@sadboi/core";
import type { agreementDetail, AgreementRecord } from "@/server/agreements";
import {
  inventoryRequest,
  InventoryRequestError,
} from "@/lib/inventory-client";
import { Button, Input, PageHeading, Textarea } from "./ui";
import { AgreementDocument } from "./agreement-document";
import { AgreementHelp } from "./agreement-help";
type Detail = Awaited<ReturnType<typeof agreementDetail>>;
function Draft({
  detail,
  frozen,
  save,
  invite,
}: {
  detail: Detail;
  frozen: boolean;
  save: (input: AgreementInput) => void;
  invite: () => void;
}) {
  const initial: AgreementInput = detail.record?.input ?? {
    title: detail.proposal.input.title,
    body: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiresDate: "",
    currency: "USD",
    totalMinor: detail.proposal.totalMinor,
  };
  const [input, setInput] = useState(initial),
    dirty = JSON.stringify(input) !== JSON.stringify(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(input);
      }}
    >
      <fieldset className="commission-fields inv-form" disabled={frozen}>
        <legend>Agreement draft</legend>
        <Input
          label="Agreement title"
          required
          minLength={3}
          maxLength={180}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
        />
        <Textarea
          label="Agreement terms"
          required
          minLength={20}
          maxLength={12000}
          rows={12}
          value={input.body}
          onChange={(e) => setInput({ ...input, body: e.target.value })}
          helperText="Enter reviewed terms. The full accepted proposal is attached to the saved agreement."
        />
        <div className="field-grid">
          <Input
            label="Effective date"
            type="date"
            required
            value={input.effectiveDate}
            onChange={(e) =>
              setInput({ ...input, effectiveDate: e.target.value })
            }
          />
          <Input
            label="Expiry date (optional)"
            type="date"
            value={input.expiresDate}
            onChange={(e) =>
              setInput({ ...input, expiresDate: e.target.value })
            }
          />
        </div>
        <p>
          Accepted proposal total: ${(input.totalMinor / 100).toFixed(2)} USD
        </p>
        <div className="inv-actions">
          <Button type="submit">Save draft</Button>
          {detail.record && (
            <Button variant="secondary" disabled={dirty} onClick={invite}>
              Create signing link
            </Button>
          )}
        </div>
        {dirty && (
          <p className="field-hint">
            Save your changes before creating a signing link.
          </p>
        )}
      </fieldset>
    </form>
  );
}
export function Agreement({
  initial,
  canEdit,
  canViewProposal,
}: {
  initial: Detail;
  canEdit: boolean;
  canViewProposal: boolean;
}) {
  const [detail, setDetail] = useState(initial),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AgreementCommand | null>(null),
    [message, setMessage] = useState("");
  const [note, setNote] = useState(""),
    [link, setLink] = useState(""),
    [preview, setPreview] = useState<AgreementRecord | null>(null);
  const [signerName, setSignerName] = useState(""),
    [signedDate, setSignedDate] = useState(""),
    [evidence, setEvidence] = useState("");
  const [epoch, setEpoch] = useState(0),
    lock = useRef(false);
  const record = detail.record,
    frozen = busy || !!pending,
    key = `sadboi-agreement-pending:${detail.proposalId}`;
  const path = `/api/agreements?proposalId=${detail.proposalId}`;
  function remember(command: AgreementCommand | null) {
    setPending(command);
    try {
      if (command) sessionStorage.setItem(key, JSON.stringify(command));
      else sessionStorage.removeItem(key);
    } catch {
      /* In-memory retry remains available. */
    }
  }
  function recovered() {
    try {
      const parsed = agreementCommandSchema.safeParse(
        JSON.parse(sessionStorage.getItem(key) ?? "null"),
      );
      return parsed.success &&
        parsed.data.source.proposalId === detail.proposalId
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
      setLink("");
      setMessage("Loaded saved agreement. Unsaved edits discarded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load agreement.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(command: AgreementCommand) {
    if (lock.current) return;
    const prior = pending ?? recovered();
    if (prior && prior.operationId !== command.operationId) {
      setPending(prior);
      setMessage("An earlier action needs confirmation. Retry it first.");
      return;
    }
    lock.current = true;
    setBusy(true);
    remember(command);
    setMessage("");
    try {
      const result: { revision: number } = await inventoryRequest(
        "/api/agreements",
        { method: "POST", body: JSON.stringify(command) },
      );
      const next: Detail = await inventoryRequest(path);
      setDetail(next);
      setPreview(null);
      remember(null);
      setNote("");
      setEpoch((n) => n + 1);
      setLink(
        command.action === "invite" &&
          next.record?.revision === result.revision &&
          next.record.state === "invited"
          ? `${window.location.origin}/agreement#${detail.proposalId}.${command.token}`
          : "",
      );
      setMessage(
        command.action === "invite"
          ? "Invitation saved. Share the private signing link below."
          : "Agreement saved with history.",
      );
    } catch (error) {
      if (
        error instanceof InventoryRequestError &&
        [400, 404, 409, 413].includes(error.status)
      )
        remember(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Save result unknown. Retry the same action.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function action(action: AgreementCommand["action"], input?: AgreementInput) {
    const token =
      action === "invite"
        ? Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("")
        : undefined;
    const parsed = agreementCommandSchema.safeParse({
      action,
      source: { proposalId: detail.proposalId },
      operationId: crypto.randomUUID(),
      expectedRevision: record?.revision ?? 0,
      note,
      ...(action === "save" ? { input } : {}),
      ...(action === "invite" ? { token } : {}),
      ...(action === "recordSignature"
        ? { signerName, signedDate, evidence }
        : {}),
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    void save(parsed.data);
  }
  return (
    <div className="commissions agreements">
      <div className="agreement-controls">
        <PageHeading
          eyebrow="PROJECTS / AGREEMENT"
          title={record?.input.title ?? "Prepare agreement"}
          description={`Prepared for ${detail.client.name}`}
        />
        <p>
          <Link href="/admin/agreements">All agreements</Link>
          {canViewProposal && (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/admin/projects/proposal?kind=inquiry&id=${detail.proposalId}`}
              >
                Back to proposal
              </Link>
            </>
          )}{" "}
          · <a href="#agreements">How to manage agreements</a>
        </p>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="inv-actions">
          <Button
            variant="secondary"
            disabled={frozen}
            onClick={() => void reload()}
          >
            Reload saved agreement
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              disabled={frozen}
              onClick={() => {
                const prior = recovered();
                if (prior) {
                  setPending(prior);
                  setMessage("Retry the pending action to confirm its result.");
                } else setMessage("No interrupted action found in this tab.");
              }}
            >
              Recover interrupted action
            </Button>
          )}
          {pending && (
            <Button disabled={busy} onClick={() => void save(pending)}>
              Retry same action
            </Button>
          )}
        </div>
        {pending && (
          <p className="notice">
            Pending action: {pending.action}. Editing is paused until its result
            is confirmed.
          </p>
        )}
        {canEdit && (
          <Textarea
            label="Private action note"
            disabled={frozen}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            helperText="Required for each staff change."
          />
        )}
        {canEdit && (!record || record.state === "draft") && (
          <Draft
            key={`${record?.revision ?? 0}:${epoch}`}
            detail={detail}
            frozen={frozen || (record?.revision ?? 0) >= 100}
            save={(input) => action("save", input)}
            invite={() => action("invite")}
          />
        )}
        {record?.state === "invited" && canEdit && (
          <fieldset
            className="commission-fields"
            disabled={frozen || record.revision >= 100}
          >
            <legend>Signing invitation</legend>
            <p>
              Link expires:{" "}
              {record.invitationExpiresAt ??
                "No active invitation; create a replacement link."}
            </p>
            <div className="inv-actions">
              <Button onClick={() => action("invite")}>
                Replace signing link
              </Button>
              <Button variant="secondary" onClick={() => action("reopen")}>
                Revoke link and reopen draft
              </Button>
            </div>
            <details>
              <summary>Record external signature</summary>
              <p>
                Use only for a signature received elsewhere. Recording it
                revokes the client link.
              </p>
              <Input
                label="Signer full name"
                value={signerName}
                maxLength={160}
                onChange={(e) => setSignerName(e.target.value)}
              />
              <Input
                label="Declared signing date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
              />
              <Textarea
                label="Signature evidence/reference"
                value={evidence}
                maxLength={2000}
                onChange={(e) => setEvidence(e.target.value)}
              />
              <Button onClick={() => action("recordSignature")}>
                Record external signature
              </Button>
            </details>
          </fieldset>
        )}
        {link && (
          <div className="notice">
            <Input label="Private signing link" readOnly value={link} />
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setMessage("Private signing link copied.");
                } catch {
                  setMessage("Select and copy the link from the field.");
                }
              }}
            >
              Copy signing link
            </Button>
            <p>
              Share only with the intended signatory. Anyone with this link can
              view and sign. No email has been sent.
            </p>
          </div>
        )}
        {record && canEdit && record.state !== "voided" && (
          <Button
            variant="ghost"
            disabled={frozen || record.revision >= 100}
            onClick={() => action("void")}
          >
            Void agreement
          </Button>
        )}
        {record?.evidence && (
          <p className="preserve-lines">
            Private signature evidence: {record.evidence}
          </p>
        )}
        <section>
          <h2>Agreement history</h2>
          {detail.history.map((event) => (
            <details key={event.record.revision}>
              <summary>
                Revision {event.record.revision} · {event.action} ·{" "}
                {event.createdAt}
              </summary>
              <p className="preserve-lines">{event.note}</p>
              <Button
                variant="secondary"
                onClick={() => setPreview(event.record)}
              >
                Preview saved version
              </Button>
            </details>
          ))}
        </section>
        {record && (
          <div className="inv-actions">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Show current document
            </Button>
            <Button onClick={() => window.print()}>Print / save PDF</Button>
            <p>
              Prints the document below. Turn off browser headers and footers.
            </p>
          </div>
        )}
        <AgreementHelp />
      </div>
      {preview && (
        <p className="notice">
          Historical revision {preview.revision}; current status is{" "}
          {record?.state}.
        </p>
      )}
      {(preview ?? record) && (
        <AgreementDocument record={(preview ?? record)!} />
      )}
    </div>
  );
}
