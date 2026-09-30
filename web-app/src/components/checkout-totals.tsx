import type { CheckoutTotals } from "@sadboi/core";
export function CheckoutTotalSummary({ pricing, totalMinor }: { pricing?: CheckoutTotals | null; totalMinor: number }) {
  const money = (value: number) => `$${(value / 100).toFixed(2)}`;
  return <div className="checkout-totals" aria-label="Order totals">
    {pricing ? <>
      <p>Items: <strong>{money(pricing.subtotalMinor)}</strong></p>
      <p>{pricing.deliveryLabel}: <strong>{money(pricing.shippingMinor)}</strong></p>
      <p>Tax: not calculated (test checkout)</p>
    </> : <p>Shipping and tax were not itemized on this order.</p>}
    <p>Total: <strong>{money(totalMinor)}</strong></p>
  </div>;
}
