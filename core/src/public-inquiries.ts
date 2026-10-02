import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
export const publicInquiryPurposes = ["commission", "shop_order", "wholesale", "press_collaboration", "general"] as const;
export const publicInquiryPurposeLabels: Record<typeof publicInquiryPurposes[number], string> = {
  commission: "Commission or custom artwork", shop_order: "Shop or order help", wholesale: "Wholesale or stockist", press_collaboration: "Press or collaboration", general: "General question",
};
export const publicInquirySchema = z.object({
  name: text(160).min(1), email: z.email().max(254), purpose: z.enum(publicInquiryPurposes), subject: text(180).min(3), message: text(4000).min(10), reference: text(180), consent: z.literal(true), website: z.literal(""),
}).strict();
export type PublicInquiry = z.infer<typeof publicInquirySchema>;
export const publicInquiryStatus = ["new", "reviewing", "replied", "closed", "spam"] as const;
export type PublicInquiryStatus = typeof publicInquiryStatus[number];
