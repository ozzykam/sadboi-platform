import { describe, expect, it } from "vitest";
import { publicInquirySchema } from "./public-inquiries";
const good = { name: "A visitor", email: "visitor@example.test", purpose: "commission", subject: "Album cover", message: "I would like to discuss an original cover illustration.", reference: "", consent: true, website: "" };
describe("public inquiries", () => {
  it("accepts a purposeful contact and rejects injected or unsafe fields", () => {
    expect(publicInquirySchema.safeParse(good).success).toBe(true);
    for (const bad of [{ ...good, consent: false }, { ...good, website: "https://spam.test" }, { ...good, email: "bad" }, { ...good, message: "short" }, { ...good, purpose: "finance", paid: true }]) expect(publicInquirySchema.safeParse(bad).success).toBe(false);
  });
});
