import { requireStaff } from "@/server/staff";
import { commissionDirectory } from "@/server/commissions";
import { Commissions } from "@/components/commissions";
export default async function Page() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  return <Commissions initial={await commissionDirectory()} canEdit={staff.role === "super_admin"} />;
}
