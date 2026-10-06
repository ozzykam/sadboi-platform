import { expect, it } from "vitest";
import { contactInputSchema, contactRelationshipKinds } from "./contacts";

const id = "a".repeat(64);
const contact = {
  kind: "person", name: "Alex", email: "alex@example.com", phone: "", website: "",
  organizationId: id, relationships: [{ kind: "client", label: "Commission" }],
  notes: "", nextFollowUp: "2026-10-01", followUpNote: "Send brief", status: "active",
};
function issues(input: unknown) {
  const result = contactInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected invalid contact");
  return result.error.issues;
}

it("validates people and organizations and identifies invalid fields", () => {
  expect(contactInputSchema.parse(contact).relationships[0].kind).toBe("client");
  expect(contactInputSchema.safeParse({ ...contact, kind: "organization", organizationId: "" }).success).toBe(true);
  expect(issues({ ...contact, kind: "organization" })).toEqual([
    expect.objectContaining({ code: "custom", path: ["organizationId"] }),
  ]);
  for (const [field, value] of [["email", "bad"], ["nextFollowUp", "2026-02-30"]]) {
    expect(issues({ ...contact, [field]: value })).toEqual([
      expect.objectContaining({ path: [field] }),
    ]);
  }
});

it("normalizes capitalized saved relationships to lowercase without changing labels or the original record", () => {
  for (const kind of contactRelationshipKinds) {
    for (const storedKind of [kind, kind[0].toUpperCase() + kind.slice(1), kind.toUpperCase()]) {
      const legacy = { ...contact, relationships: [{ kind: storedKind, label: "Commission" }] };
      const parsed = contactInputSchema.parse(legacy);
      expect(parsed.relationships).toEqual([{ kind, label: "Commission" }]);
      expect(legacy.relationships[0].kind).toBe(storedKind);
      expect(parsed.activities).toEqual([]);
      expect(contactInputSchema.parse(parsed)).toEqual(parsed);
    }
  }
  for (const kind of ["Unknown", "", null, 42]) {
    expect(issues({ ...contact, relationships: [{ kind, label: "Commission" }] })).toEqual([
      expect.objectContaining({ path: ["relationships", 0, "kind"] }),
    ]);
  }
});

it("rejects duplicate relationships after normalizing kinds and label casing", () => {
  for (const kind of ["Client", "client"]) {
    expect(issues({ ...contact, relationships: [{ kind: "client", label: "A" }, { kind, label: "a" }] })).toEqual([
      expect.objectContaining({ code: "custom", message: "Use each relationship once." }),
    ]);
  }
});

it("accepts 20 relationships and rejects 21 for the array limit", () => {
  const relationships = Array.from({ length: 20 }, (_, i) => ({ kind: "other", label: String(i) }));
  expect(contactInputSchema.safeParse({ ...contact, relationships }).success).toBe(true);
  expect(issues({ ...contact, relationships: [...relationships, { kind: "other", label: "20" }] })).toEqual([
    expect.objectContaining({ code: "too_big", path: ["relationships"], maximum: 20 }),
  ]);
});

it("rejects unexpected contact fields", () => {
  expect(issues({ ...contact, businessId: "other" })).toEqual([
    expect.objectContaining({ code: "unrecognized_keys", keys: ["businessId"] }),
  ]);
});
