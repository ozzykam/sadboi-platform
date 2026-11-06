import { requireStaff } from "@/server/staff";
import { invoiceDefaults } from "@/server/studio-invoices";
import { InvoiceDefaultsEditor } from "@/components/invoice-defaults";
export default async function Page() {
  const staff = await requireStaff(["super_admin"]);
  return <InvoiceDefaultsEditor initial={await invoiceDefaults(staff)} />;
}
