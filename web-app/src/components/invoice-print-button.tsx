"use client";
import { Button } from "./ui";
export function InvoicePrintButton() {
  return <Button onClick={() => window.print()}>Print / save PDF</Button>;
}
