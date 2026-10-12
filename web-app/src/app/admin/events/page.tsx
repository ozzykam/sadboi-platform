import { requireStaff } from "@/server/staff";
import { eventDirectory } from "@/server/events";
import { Events } from "@/components/events";
export default async function Page() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  return (
    <Events
      events={await eventDirectory(staff)}
      canEdit={staff.role === "super_admin"}
      now={new Date().toISOString()}
    />
  );
}
