import "server-only";
import { createHash } from "node:crypto";
import {
  defaultSeoInput,
  seoInputSchema,
  seoSaveSchema,
  type SeoSettings,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
export const seoSettingsRef = () =>
  adminServices().db.doc(`businesses/${businessId}/inventoryState/seo`);
export function readSeoSettings(
  data: FirebaseFirestore.DocumentData | undefined,
): SeoSettings {
  if (!data) return { revision: 0, input: defaultSeoInput };
  const input = seoInputSchema.safeParse(data.input);
  if (
    data.businessId !== businessId ||
    !input.success ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1
  )
    throw new AccessError(
      503,
      "seo-settings",
      "SEO settings need administrator review.",
    );
  return { input: input.data, revision: data.revision };
}
export async function seoSettings() {
  return readSeoSettings((await seoSettingsRef().get()).data());
}
export async function saveSeoSettings(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can change website SEO settings.",
    );
  const parsed = seoSaveSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "seo-settings",
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const { operationId, expectedRevision, input } = parsed.data,
    db = adminServices().db;
  const operation = db.doc(
    `businesses/${businessId}/seoOperations/${createHash("sha256")
      .update(staff.uid + ":" + operationId)
      .digest("hex")}`,
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ expectedRevision, input }))
    .digest("hex");
  return db.runTransaction(async (tx) => {
    const [old, settings] = await Promise.all([
      tx.get(operation),
      tx.get(seoSettingsRef()),
    ]);
    if (old.exists) {
      if (old.data()!.fingerprint !== fingerprint)
        throw new AccessError(
          409,
          "seo-conflict",
          "This save request was used for different settings.",
        );
      return old.data()!.result as SeoSettings;
    }
    const previous = readSeoSettings(settings.data());
    if (previous.revision !== expectedRevision)
      throw new AccessError(
        409,
        "seo-conflict",
        "SEO settings changed. Reload before saving.",
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
        resource: "seo",
        recordId: "seo",
        kind: "seo_settings_saved",
        before: previous,
        after: result,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    return result;
  });
}
