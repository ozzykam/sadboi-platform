import { describe, expect, it } from "vitest";
import { orderIsDue, orderCloseSchema, paymentReviewSchema } from "./order-lifecycle";
import { decideStorePayment, type PaymentConfirmation } from "./store-payments";
describe("order lifecycle", () => {
  it("expires only pending orders at their explicit deadline", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    expect(orderIsDue({status:"pending_payment", expiresAt:new Date(now).toISOString()},now)).toBe(true);
    for (const expiresAt of [undefined,null,"invalid",new Date(now+1).toISOString()]) expect(orderIsDue({status:"pending_payment",expiresAt},now)).toBe(false);
    for (const status of ["paid","fulfilled","cancelled","expired"]) expect(orderIsDue({status,expiresAt:new Date(now-1).toISOString()},now)).toBe(false);
  });
  it("requires operation identity and a real refund reference", () => {
    expect(orderCloseSchema.safeParse({orderId:"a".repeat(32),reason:"Cancel"}).success).toBe(false);
    const body={orderId:"a".repeat(32),eventId:"stripe:acct_123:test:evt_123",operationId:"d420a9de-245e-4cd4-9e28-e128e8831583",expectedRevision:0,action:"record_refund",reference:"",notes:"Full refund was issued."};
    expect(paymentReviewSchema.safeParse(body).success).toBe(false);
    expect(paymentReviewSchema.safeParse({...body,reference:"re_123"}).success).toBe(true);
  });
  it("never applies success after closure or deadline", () => {
    const input:PaymentConfirmation={orderId:"a".repeat(32),eventId:"evt_123456",provider:"stripe",paymentId:"pi_123",amountMinor:5000,currency:"USD",status:"succeeded"};
    for (const status of ["pending_payment","expired","cancelled"]) expect(decideStorePayment({status,totalMinor:5000,expiresAt:"2000-01-01T00:00:00Z"},input).reason).toBe("late_success");
  });
});
