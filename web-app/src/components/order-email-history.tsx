"use client";
import { useState } from "react";
import Link from "next/link";
import type { orderEmailHistory } from "@/server/order-emails";
import { inventoryRequest } from "@/lib/inventory-client";
import { Button, Badge } from "./ui";
import { orderEmailLabels, type OrderEmailKind } from "@sadboi/core";
type History = Awaited<ReturnType<typeof orderEmailHistory>>;
const labels: Record<string, string> = { disabled: "Sending disabled", queued: "Queued", sending: "Sending", retry: "Retry scheduled", accepted: "Accepted by email provider", failed: "Delivery blocked", needs_review: "Needs review", superseded: "Not sent: order changed" };
export function OrderEmailHistory({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [history, setHistory] = useState<History | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function load() { const result: History = await inventoryRequest(`/api/store/order-emails?orderId=${orderId}`); setHistory(result); }
  async function run(action?: "process" | "retry", email?: History["emails"][number]) {
    setBusy(true); setMessage("");
    try {
      if (action) {
        await inventoryRequest("/api/store/order-emails", { method: "POST", body: JSON.stringify({ action, orderId, ...(email ? { id: email.id, expectedRevision: email.revision } : {}) }) });
        setMessage("Email queue checked. Review the latest delivery status below.");
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Email history could not load. Refresh before retrying."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="order-emails-title" className="inv-panel">
    <h3 id="order-emails-title">Order emails</h3>
    <p>Order, payment, pickup and shipping updates include a private link for the customer. Provider acceptance does not confirm inbox delivery.</p>
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void run()}>{busy ? "Checking emails…" : history ? "Refresh email history" : "Load email history"}</Button>
      <Link href="/admin/how-to#order-emails" className="inline-link">How to manage order emails</Link></div>
    {message && <p role="status" className="notice">{message}</p>}
    {history && <>
      {history.configuration !== "ready" && <p className="notice">{history.configuration === "disabled" ? "Email sending is disabled. Saved previews are not sent later automatically when email is enabled." : "Email setup is incomplete. Ask the administrator to check the sender and approved test recipients."}</p>}
      {canEdit && history.configuration === "ready" && <Button variant="secondary" disabled={busy} onClick={() => void run("process")}>Process due emails</Button>}
      {!history.emails.length && <p>No emails were queued for this order. Older orders are not emailed automatically.</p>}
      {history.hasOlder && <p>Showing the 50 most recent emails. Older records remain in the studio history; contact the administrator to review them.</p>}
      <div className="inv-cards">{history.emails.map(email => <article key={email.id} className="inv-panel">
        <h4>{orderEmailLabels[email.kind as OrderEmailKind] ?? email.kind}</h4><Badge>{labels[email.status] ?? email.status}</Badge>
        <p>To: {email.recipient}</p><p>Attempts: {email.attempts} · Updated: {email.updatedAt}</p>
        {email.nextAttemptAt && <p>Next check after: {email.nextAttemptAt}</p>}
        {email.lastError && <p className="notice">{email.status === "superseded" ? "The saved fulfillment changed before this message was attempted. Open the order for its current status." : email.lastError === "recipient_not_approved" ? "This address is not approved for test delivery." : email.status === "needs_review" ? "Check the provider's records before taking further action. Automatic retries have stopped to avoid a duplicate email." : "The email could not be submitted. Check the provider setup before retrying."}</p>}
        {email.providerId && <p style={{ overflowWrap: "anywhere" }}>Provider reference: {email.providerId}</p>}
        <details><summary>Preview email</summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{email.preview}</p></details>
        {canEdit && history.configuration === "ready" && email.status === "failed" && <Button disabled={busy} variant="secondary" onClick={() => void run("retry", email)}>Retry delivery</Button>}
      </article>)}</div>
    </>}
  </section>;
}
