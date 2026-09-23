import { Contacts } from "@/components/contacts";
import { contactsDirectory } from "@/server/contacts";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() !== "staff") return null;
  const staff = await requireStaff(["super_admin", "legal", "accounting"]);
  return (
    <Contacts
      initial={await contactsDirectory()}
      canEdit={staff.role === "super_admin"}
    />
  );
}
