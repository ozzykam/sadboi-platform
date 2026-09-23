# Stripe payment confirmation handoff

Updated September 21, 2026.

The storefront now has a provider-neutral confirmation endpoint:

`POST /api/store/orders/{orderId}/payment-confirmation`

It requires the server secret header `x-sadboi-payment-secret` matching `SADBOI_PAYMENT_WEBHOOK_SECRET`. The payload must include:

```json
{
  "eventId": "evt_...",
  "orderId": "...",
  "provider": "stripe",
  "paymentId": "pi_...",
  "amountMinor": 5000,
  "currency": "USD",
  "status": "succeeded"
}
```

The endpoint is idempotent by `eventId`. It verifies the order total and pending-payment state, records the provider event, and changes the order to `paid`. Failed confirmations leave the order pending. Stocked units are already allocated when the order is created, so payment confirmation does not reduce `onHand`; fulfillment will consume allocated stock later. Made-to-order lines do not require on-hand stock.

**Pending external setup:** Stripe connection is intentionally paused until the Sadboi LLC is filed and the Sadboi Stripe account is approved. When Stripe details are available, add a webhook handler in a deployed Cloud Function or Cloud Run service. Verify Stripe’s signature there, map the verified event to this payload, and call the endpoint over HTTPS. Keep the webhook secret in Secret Manager or the hosting platform’s secret store. Do not expose it in browser code. Configure `SADBOI_PAYMENT_WEBHOOK_SECRET` in the web app and use a separate secret for local emulators.

Stripe Checkout session creation, shipping collection, refunds through Stripe, and fulfillment consumption are intentionally not wired yet.
