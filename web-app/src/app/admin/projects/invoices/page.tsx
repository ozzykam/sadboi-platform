import { requireStaff } from "@/server/staff";
import { commissionBillingDetail } from "@/server/commission-billing";
import { CommissionBilling } from "@/components/commission-billing";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ proposalId?: string }>;
}) {
  const staff = await requireStaff(["super_admin", "accounting"]);
  const { proposalId } = await searchParams;
  return (
    <CommissionBilling
      initial={await commissionBillingDetail(proposalId, staff)}
      canEdit={staff.role === "super_admin"}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
