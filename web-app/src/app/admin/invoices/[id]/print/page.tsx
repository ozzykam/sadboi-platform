import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError, requireStaff } from "@/server/staff";
import { studioInvoiceDetail } from "@/server/studio-invoices";
import { StudioInvoiceDocument } from "@/components/studio-invoice-document";
import { InvoicePrintButton } from "@/components/invoice-print-button";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff(["super_admin", "accounting"]),
    { id } = await params;
  const { invoice } = await studioInvoiceDetail(id, staff).catch(
    (error: unknown) => {
      if (error instanceof AccessError && [400, 404].includes(error.status))
        notFound();
      throw error;
    },
  );
  return (
    <div className="invoice-print-view">
      <div className="invoice-print-controls">
        <Link href={`/admin/invoices/${id}`}>Back to invoice</Link>
        <InvoicePrintButton />
        <p>
          In the print dialog, choose Save as PDF and turn off browser headers
          and footers. This page is private; share the exported file with the
          client.
        </p>
      </div>
      <StudioInvoiceDocument
        invoice={invoice}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
