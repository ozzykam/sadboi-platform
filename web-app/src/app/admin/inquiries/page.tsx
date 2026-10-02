import { requireStaff } from "@/server/staff";
import { publicInquiryDirectory } from "@/server/public-inquiries";
import { PublicInquiries } from "@/components/public-inquiries";
export default async function Page() { const staff = await requireStaff(["super_admin", "accounting"]); return <PublicInquiries initial={await publicInquiryDirectory(staff)} canEdit={staff.role === "super_admin"} />; }
