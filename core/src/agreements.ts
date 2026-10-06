import { z } from "zod";
import { inventoryId } from "./inventory";

const text = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(""), z.iso.date()]);
export const agreementTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const agreementConsent =
  "I have read this agreement and its attached proposal. I agree to these terms and intend my full name below to serve as my electronic signature.";

export const agreementStates = [
  "draft",
  "invited",
  "signed",
  "voided",
] as const;
export type AgreementState = (typeof agreementStates)[number];

export const agreementInputSchema = z
  .object({
    title: text(180).min(3),
    body: text(12000).min(20),
    effectiveDate: z.iso.date(),
    expiresDate: date,
    currency: z.literal("USD"),
    totalMinor: z.number().int().min(0).max(100_000_000),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.expiresDate && input.expiresDate < input.effectiveDate)
      ctx.addIssue({
        code: "custom",
        path: ["expiresDate"],
        message: "The expiry date cannot be before the effective date.",
      });
  });
export type AgreementInput = z.infer<typeof agreementInputSchema>;

export const agreementSourceSchema = z
  .object({ proposalId: inventoryId })
  .strict();
const fields = {
  source: agreementSourceSchema,
  operationId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(99),
  note: text(2000).min(3),
};
export const agreementCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...fields,
      action: z.literal("save"),
      input: agreementInputSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      action: z.literal("invite"),
      token: agreementTokenSchema,
    })
    .strict(),
  z.object({ ...fields, action: z.literal("reopen") }).strict(),
  z
    .object({
      ...fields,
      action: z.literal("recordSignature"),
      signerName: text(160).min(2),
      signedDate: z.iso.date(),
      evidence: text(2000).min(3),
    })
    .strict(),
  z.object({ ...fields, action: z.literal("void") }).strict(),
]);
export type AgreementCommand = z.infer<typeof agreementCommandSchema>;

const access = { proposalId: inventoryId, token: agreementTokenSchema };
export const agreementAccessSchema = z.discriminatedUnion("action", [
  z.object({ ...access, action: z.literal("read") }).strict(),
  z
    .object({
      ...access,
      action: z.literal("sign"),
      operationId: z.uuid(),
      documentHash: agreementTokenSchema,
      expectedRevision: z.number().int().min(1).max(99),
      signerName: text(160).min(2),
      signedDate: z.iso.date(),
      consent: z.literal(true),
    })
    .strict(),
]);
export type AgreementAccess = z.infer<typeof agreementAccessSchema>;
export function assertSigningDate(date: string, today: string) {
  if (date > today)
    throw new Error("The signing date cannot be in the future.");
}

export function agreementTransition(
  state: AgreementState | null,
  action: AgreementCommand["action"],
): AgreementState {
  if (action === "save" && (state === null || state === "draft"))
    return "draft";
  if (action === "invite" && (state === "draft" || state === "invited"))
    return "invited";
  if (action === "reopen" && state === "invited") return "draft";
  if (action === "recordSignature" && state === "invited") return "signed";
  if (action === "void" && state && state !== "voided") return "voided";
  throw new Error(
    "This agreement action is unavailable for the saved agreement.",
  );
}
