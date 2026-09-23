import { z } from "zod";
export const paymentConfirmationSchema = z.object({ eventId: z.string().trim().min(8).max(200), orderId: z.string().trim().min(16).max(100), provider: z.enum(["stripe"]), paymentId: z.string().trim().min(1).max(200), amountMinor: z.number().int().positive().max(100_000_000_000), currency: z.literal("USD"), status: z.enum(["succeeded", "failed"]) }).strict();
export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>;
