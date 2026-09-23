import Link from "next/link";
import { Overview } from "@/components/overview";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() !== "staff") return <Overview />;
  const staff = await requireStaff();
  return (
    <section>
      <p className="eyebrow">WELCOME TO THE STUDIO</p>
      <h1>
        A home for
        <br />
        what comes next.
      </h1>
      <p className="subtitle">You are signed in as {staff.email}.</p>
      <div className="staff-summary">
        <p className="eyebrow">STUDIO ACCESS</p>
        <h2>Your workspace is ready.</h2>
        <p>
          {staff.role === "super_admin"
            ? "You have super-admin access to Sadboi’s business."
            : "Your workspace is limited to your assigned staff role."}
        </p>
        <p>
          The shared artwork library and inventory are ready. Track products,
          stock, and transfers across the studio, galleries, and events.
        </p>
        {staff.role !== "accounting" && (
          <Link className="button primary" href="/admin/artworks">
            Open artwork library
          </Link>
        )}
        {staff.role !== "legal" && (
          <Link className="button secondary" href="/admin/inventory">
            Open inventory
          </Link>
        )}
      </div>
    </section>
  );
}
