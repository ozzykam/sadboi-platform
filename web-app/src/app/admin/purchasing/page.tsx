import { Purchasing } from "@/components/purchasing";
import { purchasingCatalog, quoteCatalog } from "@/server/purchasing";
import { inventoryCatalog } from "@/server/inventory";
import { requireStaff } from "@/server/staff";
import {
  financeCatalog,
  journalCatalog,
  paymentCatalog,
} from "@/server/finance";
export default async function Page() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  const [
    initial,
    initialInventory,
    initialQuotes,
    initialFinance,
    initialJournal,
    initialPayments,
  ] = await Promise.all([
    purchasingCatalog(),
    inventoryCatalog(),
    quoteCatalog(),
    financeCatalog(),
    journalCatalog(),
    paymentCatalog(),
  ]);
  return (
    <Purchasing
      initial={initial}
      initialInventory={initialInventory}
      initialQuotes={initialQuotes}
      initialFinance={initialFinance}
      initialJournal={initialJournal}
      initialPayments={initialPayments}
      canEdit={staff.role === "super_admin"}
    />
  );
}
