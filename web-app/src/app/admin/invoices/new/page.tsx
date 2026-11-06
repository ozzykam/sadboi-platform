import { randomUUID } from "node:crypto";
import { newStudioInvoice } from "@sadboi/core";
import { requireStaff } from "@/server/staff";
import {
  invoiceDefaults,
  invoiceContactOptions,
} from "@/server/studio-invoices";
import { StudioInvoiceEditor } from "@/components/studio-invoice-editor";
import { flightOfTheConchordsInvoice } from "@/lib/invoice-starters";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string }>;
}) {
  const staff = await requireStaff(["super_admin"]);
  const [defaults, contacts, query] = await Promise.all([
    invoiceDefaults(staff),
    invoiceContactOptions(staff),
    searchParams,
  ]);
  return (
    <StudioInvoiceEditor
      id={randomUUID()}
      initial={null}
      initialInput={
        query.starter === "flight-of-the-conchords"
          ? flightOfTheConchordsInvoice(defaults.input)
          : newStudioInvoice(defaults.input)
      }
      contacts={contacts}
      canEdit
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
