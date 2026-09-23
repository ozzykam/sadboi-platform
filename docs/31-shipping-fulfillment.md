# Shipping and fulfillment foundation

Updated September 21, 2026.

Paid public orders can now receive a fulfillment record with recipient/address details, pickup/standard/express method, tracking number, and status: Unfulfilled, Packed, Shipped, Delivered, or Cancelled.

Delivered stocked orders consume allocated units from online-eligible locations by reducing both allocated and on-hand quantities. Cancelled orders release allocated units without reducing on-hand stock. Fulfillment requires a paid order; payment confirmation remains behind the provider-neutral webhook boundary until Stripe setup is complete.
