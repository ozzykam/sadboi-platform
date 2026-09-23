import { Shell } from "@/components/shell";
import { StaffShell } from "@/components/staff-shell";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mode = getMode();
  if (mode === "staff")
    return <StaffShell staff={await requireStaff()}>{children}</StaffShell>;
  if (mode === "locked")
    return (
      <main className="locked-screen">
        <p className="eyebrow">SADBOI STUDIO</p>
        <h1>This workspace is locked.</h1>
        <Link href="/" className="button secondary">
          Back to entrance
        </Link>
      </main>
    );
  return <Shell>{children}</Shell>;
}
