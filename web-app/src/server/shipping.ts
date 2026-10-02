import "server-only";
import { createHash } from "node:crypto";
import {
  defaultShippingPolicy,
  shippingPolicySchema,
  shippingSaveSchema,
  type ShippingSettings,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
export const shippingSettingsRef = () =>
  adminServices().db.doc(`businesses/${businessId}/inventoryState/shipping`);
export function readShippingSettings(
  data: FirebaseFirestore.DocumentData | undefined,
): ShippingSettings {
  if (!data) return { revision: 0, input: defaultShippingPolicy };
  const input = shippingPolicySchema.safeParse(data.input);
  if (
    data.businessId !== businessId ||
    !input.success ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1
  )
    throw new AccessError(
      503,
      "shipping-settings",
      "Shipping settings need administrator review.",
    );
  return { input: input.data, revision: data.revision };
}
export async function shippingSettings() {
  return readShippingSettings((await shippingSettingsRef().get()).data());
}
export async function saveShippingSettings(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can change shipping rates.",
    );
  const parsed = shippingSaveSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "shipping-settings",
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const { operationId, expectedRevision, input } = parsed.data,
    db = adminServices().db;
  const operation = db.doc(
    `businesses/${businessId}/shippingOperations/${createHash("sha256")
      .update(staff.uid + ":" + operationId)
      .digest("hex")}`,
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ expectedRevision, input }))
    .digest("hex");
  return db.runTransaction(async (tx) => {
    const [old, settings] = await Promise.all([
      tx.get(operation),
      tx.get(shippingSettingsRef()),
    ]);
    if (old.exists) {
      if (old.data()!.fingerprint !== fingerprint)
        throw new AccessError(
          409,
          "shipping-conflict",
          "This save request was used for different settings.",
        );
      return old.data()!.result as ShippingSettings;
    }
    const previous = readShippingSettings(settings.data());
    if (previous.revision !== expectedRevision)
      throw new AccessError(
        409,
        "shipping-conflict",
        "Shipping settings changed. Reload before saving.",
      );
    const result = { input, revision: expectedRevision + 1 },
      now = new Date().toISOString();
    tx.set(settings.ref, {
      ...result,
      businessId,
      updatedAt: now,
      updatedBy: staff.uid,
    });
    tx.create(operation, {
      businessId,
      fingerprint,
      result,
      createdAt: now,
      actorId: staff.uid,
    });
    tx.create(
      db.doc(`businesses/${businessId}/inventoryAudit/${operation.id}`),
      {
        businessId,
        resource: "shipping",
        recordId: "shipping",
        kind: "shipping_settings_saved",
        before: previous,
        after: result,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    return result;
  });
}
