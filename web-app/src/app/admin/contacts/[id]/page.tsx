import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/contact-detail";
import { contactById } from "@/server/contacts";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (getMode() === "locked" || getMode() !== "staff") return null;
  const staff = await requireStaff(["super_admin", "legal", "accounting"]);
  const record = await contactById((await params).id);
  if (!record) notFound();
  return <ContactDetail record={record} canEdit={staff.role === "super_admin"} />;
}
