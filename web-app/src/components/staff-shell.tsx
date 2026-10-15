import Link from "next/link";
import type { Staff } from "@/server/staff";
import { SignOut } from "./sign-out";
export function StaffShell({
  staff,
  children,
}: {
  staff: Staff;
  children: React.ReactNode;
}) {
  return (
    <div className="staff-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="staff-header">
        <Link href="/admin" className="wordmark">
          sadboi<small>STUDIO MANAGER</small>
        </Link>
        <SignOut />
      </header>
      <nav className="staff-nav" aria-label="Studio navigation">
        <Link href="/admin">Overview</Link>
        {staff.role === "super_admin" && <Link href="/admin/collections">Collections</Link>}
        {staff.role !== "accounting" && (
          <Link href="/admin/artworks">Artwork</Link>
        )}
        {staff.role !== "legal" && (
          <Link href="/admin/inventory">Inventory</Link>
        )}
        {staff.role !== "legal" && (
          <Link href="/admin/purchasing">Purchasing</Link>
        )}
        <Link href="/admin/contacts">Contacts</Link>
        <Link href="/admin/agreements">Agreements</Link>
        {staff.role !== "legal" && <Link href="/admin/invoices">Invoices</Link>}
        {staff.role !== "legal" && <Link href="/admin/inquiries">Inquiries</Link>}
        {staff.role !== "legal" && <Link href="/admin/projects">Projects</Link>}
        {staff.role !== "legal" && <Link href="/admin/events">Events</Link>}
        {staff.role !== "legal" && <Link href="/admin/orders">Orders</Link>}
        {staff.role !== "legal" && <Link href="/admin/shipping">Shipping</Link>}
        {staff.role !== "legal" && <Link href="/admin/how-to">How-to</Link>}
        {staff.role === "super_admin" && (
          <Link href="/admin/settings">Workspace</Link>
        )}
      </nav>
      <main id="main-content" className="staff-content">
        {children}
      </main>
      <footer className="staff-footer">
        <span>{staff.email}</span>
        <span>
          {staff.role === "super_admin"
            ? "Super admin"
            : staff.role === "legal"
              ? "Legal"
              : "Accounting"}
        </span>
      </footer>
    </div>
  );
}
export function StaffModule({ title }: { title: string }) {
  return (
    <section>
      <p className="eyebrow">SADBOI STUDIO</p>
      <h1>{title}</h1>
      <p className="subtitle">
        This part of the studio is being built. Your staff access is ready.
      </p>
      <Link href="/admin" className="button secondary">
        Back to overview
      </Link>
    </section>
  );
}
