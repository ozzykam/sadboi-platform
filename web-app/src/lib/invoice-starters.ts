import { newStudioInvoice, type InvoiceDefaults } from "@sadboi/core";
export function flightOfTheConchordsInvoice(defaults: InvoiceDefaults) {
  const input = newStudioInvoice(defaults);
  return {
    ...input,
    title: "Flight of the Conchords — custom artwork",
    billTo: { ...input.billTo, name: "Jermaine of Flight of the Conchords" },
    dueDays: 30,
    paymentMethod: "stripe" as const,
    paymentInstructions:
      "Please pay via the Stripe payment link on this invoice. Payment is due within 30 days of the invoice issue date.",
    lines: [
      {
        description: "Custom artwork for Flight of the Conchords poster",
        quantity: 1,
        unitMinor: 180000,
      },
      {
        description: "Custom artwork for Flight of the Conchords tea towel",
        quantity: 1,
        unitMinor: 50000,
      },
    ],
    usage: {
      status: "proposed" as const,
      text: "The commissioned artwork may be used only for Flight of the Conchords posters and tea towels. Any use on T-shirts, sweatshirts, stickers, other apparel, or merchandise other than posters and tea towels requires Sadboi’s express written permission in advance.",
      acceptanceReference: "",
    },
  };
}
