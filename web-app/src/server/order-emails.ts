import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { emailRetryDelay, emailRetryIsUnsafe, orderEmailLinkPlaceholder, storePaymentOrderId } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { orderEmailConfig, submitOrderEmail, type EmailPayload } from "./order-email-provider";

const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const messageRef = (id: string) => collection("orderEmails").doc(id);
function orderId(value: unknown) {
  const parsed = storePaymentOrderId.safeParse(value);
  if (!parsed.success) throw new AccessError(400, "email-order", "Select a valid order.");
  return parsed.data;
}

export async function orderEmailHistory(rawId: unknown) {
  const id = orderId(rawId), order = await collection("storeOrders").doc(id).get();
  if (!order.exists || order.data()!.businessId !== businessId) throw new AccessError(404, "email-order", "Order not found.");
  const rows = await collection("orderEmails").where("orderId", "==", id).orderBy("createdAt", "desc").limit(51).get();
  let configuration: "disabled" | "ready" | "incomplete" = "disabled";
  try { if (orderEmailConfig()) configuration = "ready"; } catch { configuration = "incomplete"; }
  return { configuration, hasOlder: rows.size > 50, emails: rows.docs.slice(0, 50).map(doc => {
    const data = doc.data();
    // Neither HTML, private tokens nor operation pointers reach the staff UI.
    return { id: doc.id, kind: String(data.kind), status: String(data.status), recipient: String(data.recipient),
      attempts: Number(data.attempts), createdAt: String(data.createdAt), updatedAt: String(data.updatedAt),
      nextAttemptAt: data.active ? String(data.nextAttemptAt) : null, providerId: data.providerId as string | null,
      lastError: data.lastError as string | null, revision: Number(data.revision),
      preview: String(data.template.text).replaceAll(orderEmailLinkPlaceholder, "[Private order link — hidden in staff preview]"),
    };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) };
}

async function claimEmail(id: string, config: NonNullable<ReturnType<typeof orderEmailConfig>>) {
  return adminServices().db.runTransaction(async tx => {
    const ref = messageRef(id), record = await tx.get(ref), data = record.data(), now = Date.now();
    if (!data || data.businessId !== businessId || !data.active || Date.parse(data.nextAttemptAt) > now || Date.parse(data.leaseUntil ?? "") > now) return null;
    const stop = (status: string, error: string) => {
      tx.update(ref, { status, active: false, lastError: error, leaseId: null, leaseUntil: null, updatedAt: new Date(now).toISOString(), revision: data.revision + 1 });
      return null;
    };
    if (emailRetryIsUnsafe(data.firstAttemptAt, data.attempts, now)) return stop("needs_review", "retry_window_ended");
    if (!data.firstAttemptAt && now - Date.parse(data.createdAt) >= 24 * 60 * 60_000) return stop("needs_review", "message_too_old");
    if (!config.recipients.includes(String(data.recipient).toLowerCase())) return stop("failed", "recipient_not_approved");
    const [order, access] = await Promise.all([
      tx.get(collection("storeOrders").doc(data.orderId)),
      tx.get(collection("storeOrderOperations").doc(data.accessOperationId)),
    ]);
    const orderData = order.data(), result = access.data()?.result, token = result?.managementToken;
    if (!orderData || orderData.businessId !== businessId || result?.id !== data.orderId || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
        hash(token) !== orderData.managementTokenHash || orderData.input.customerEmail !== data.recipient)
      return stop("needs_review", "private_link_unavailable");
    // Only suppress messages never submitted. After any attempt the provider may
    // have accepted it; recovery must keep the same payload and idempotency key.
    if (data.fulfillmentEvent && !data.firstAttemptAt) {
      const fulfillment = (await tx.get(collection("fulfillments").doc(data.orderId))).data();
      const event = data.fulfillmentEvent;
      if (orderData.status !== "paid" || fulfillment?.businessId !== businessId || fulfillment.notificationRevision !== event.revision ||
          fulfillment.input?.status !== event.status || fulfillment.input?.method !== event.method ||
          (event.status === "shipped" && fulfillment.input?.trackingNumber !== event.trackingNumber))
        return stop("superseded", "fulfillment_changed");
    }
    // Frozen template + origin + original capability + sender = same payload on
    // every attempt, including after provider acceptance but before Firestore save.
    const sender = data.sender ?? { from: config.from, replyTo: config.replyTo };
    const url = `${data.origin}/orders/${data.orderId}#${token}`;
    const payload: EmailPayload = { from: sender.from, to: [data.recipient], subject: data.template.subject,
      text: data.template.text.replaceAll(orderEmailLinkPlaceholder, url), html: data.template.html.replaceAll(orderEmailLinkPlaceholder, url),
      ...(sender.replyTo ? { reply_to: sender.replyTo } : {}) };
    const digest = hash(JSON.stringify(payload));
    if (data.payloadHash && data.payloadHash !== digest) return stop("needs_review", "message_changed");
    const leaseId = randomUUID();
    tx.update(ref, { status: "sending", sender, payloadHash: digest, leaseId, leaseUntil: new Date(now + 90_000).toISOString(),
      firstAttemptAt: data.firstAttemptAt ?? new Date(now).toISOString(), attempts: data.attempts + 1, updatedAt: new Date(now).toISOString(), revision: data.revision + 1 });
    return { leaseId, payload };
  });
}

export async function processOrderEmails(rawOrderId?: string) {
  const config = orderEmailConfig();
  if (!config) return { status: "disabled", processed: 0, results: [] };
  const stateRef = collection("inventoryState").doc("orderEmails");
  const previous = rawOrderId ? null : (await stateRef.get()).data();
  let query = rawOrderId
    ? collection("orderEmails").where("orderId", "==", orderId(rawOrderId)).where("active", "==", true).orderBy("__name__").limit(25)
    : collection("orderEmails").where("active", "==", true).orderBy("__name__").limit(25);
  if (previous?.cursor) query = query.startAfter(previous.cursor);
  let batch = await query.get();
  if (batch.empty && previous?.cursor) batch = await collection("orderEmails").where("active", "==", true).orderBy("__name__").limit(25).get();
  const results: Array<{ id: string; status: string }> = [];
  let lastId: string | null = null;
  for (const row of batch.docs) {
    lastId = row.id;
    const claimed = await claimEmail(row.id, config);
    if (!claimed) continue;
    const submitted = await submitOrderEmail(config, row.id, claimed.payload);
    await adminServices().db.runTransaction(async tx => {
      const current = await tx.get(row.ref), data = current.data();
      if (!data || data.leaseId !== claimed.leaseId) return;
      const now = Date.now(), status = submitted.status === "retry" && emailRetryIsUnsafe(data.firstAttemptAt, data.attempts, now) ? "needs_review" : submitted.status;
      tx.update(row.ref, { status, active: status === "retry", leaseId: null, leaseUntil: null,
        lastError: "error" in submitted ? submitted.error : null,
        providerId: "providerId" in submitted ? submitted.providerId : null,
        nextAttemptAt: new Date(now + emailRetryDelay(data.attempts)).toISOString(), updatedAt: new Date(now).toISOString(), revision: data.revision + 1 });
    });
    results.push({ id: row.id, status: submitted.status });
    if (results.length >= 3) break; // At most 24 seconds of provider I/O per run.
  }
  if (!rawOrderId) await stateRef.set({ cursor: lastId, lastRunAt: new Date().toISOString(), results });
  return { status: "checked", processed: results.length, results };
}

export async function retryOrderEmail(body: Record<string, unknown>, staff: Staff) {
  if (staff.role !== "super_admin") throw new AccessError(403, "forbidden", "Only super admins can retry order emails.");
  const id = orderId(body.orderId);
  if (typeof body.id !== "string" || !new RegExp(`^${id}_(order_received|payment_confirmed|(?:pickup_ready|order_shipped|tracking_updated)_[1-9][0-9]{0,9})$`).test(body.id) || !Number.isInteger(body.expectedRevision))
    throw new AccessError(400, "email-request", "Select an email and refresh its delivery history.");
  const config = orderEmailConfig();
  if (!config) throw new AccessError(409, "email-disabled", "Email sending is disabled.");
  await adminServices().db.runTransaction(async tx => {
    const ref = messageRef(body.id as string), record = await tx.get(ref), data = record.data();
    if (!data || data.businessId !== businessId || data.orderId !== id || data.revision !== body.expectedRevision || data.status !== "failed")
      throw new AccessError(409, "email-conflict", "This email changed or cannot be retried. Refresh its history.");
    if (emailRetryIsUnsafe(data.firstAttemptAt, data.attempts, Date.now()))
      throw new AccessError(409, "email-review", "This email needs provider reconciliation before any further sending.");
    if (!config.recipients.includes(data.recipient.toLowerCase())) throw new AccessError(409, "email-recipient", "The recipient is not approved for test delivery.");
    const now = new Date().toISOString();
    tx.update(ref, { status: "queued", active: true, nextAttemptAt: now, updatedAt: now, lastError: null, revision: data.revision + 1 });
    tx.create(collection("inventoryAudit").doc(), { businessId, resource: "orderEmails", recordId: ref.id, kind: "email_retry_requested", actorId: staff.uid, createdAt: now });
  });
}
