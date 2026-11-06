import { notFound } from "next/navigation";
import { AccessError, requireStaff } from "@/server/staff";
import {
  studioInvoiceDetail,
  invoiceContactOptions,
} from "@/server/studio-invoices";
import { StudioInvoiceEditor } from "@/components/studio-invoice-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff(["super_admin", "accounting"]),
    { id } = await params;
  const [detail, contacts] = await Promise.all([
    studioInvoiceDetail(id, staff),
    staff.role === "super_admin"
      ? invoiceContactOptions(staff)
      : Promise.resolve([]),
  ]).catch((error: unknown) => {
    if (error instanceof AccessError && [400, 404].includes(error.status))
      notFound();
    throw error;
  });
  return (
    <StudioInvoiceEditor
      key={`${id}:${detail.invoice.revision}`}
      id={id}
      initial={detail}
      initialInput={detail.invoice.input}
      contacts={contacts}
      canEdit={staff.role === "super_admin"}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
