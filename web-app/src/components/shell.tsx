"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleHelp,
  GalleryVerticalEnd,
  LayoutDashboard,
  Menu,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { useDrafts } from "@/lib/draft-store";

const navigation = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/artworks", label: "Artwork", Icon: GalleryVerticalEnd },
  { href: "/admin/inventory", label: "Inventory", Icon: Boxes },
  { href: "/admin/settings", label: "Workspace", Icon: Settings2 },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { error } = useDrafts();
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/admin" className="wordmark">
          sadboi<small>STUDIO MANAGER</small>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">S</span>
          <div>
            Sadboi studio<small>Joel Hedstrom</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/admin"
                    ? pathname === href
                    : pathname.startsWith(href)
                )
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} strokeWidth={1.6} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="tiny-rule" />
          <p>
            A home for the work.
            <br />
            Room for what comes next.
          </p>
          <Link href="/">
            View project entrance <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="profile">
          <span className="profile-avatar">S</span>
          <div>
            Studio preview<small>Local workspace</small>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Studio</span>
            <ChevronRight size={13} />
            {navigation.find((n) => n.href === pathname)?.label ?? "Artwork"}
          </div>
          <Link href="/admin" className="mobile-wordmark">
            sadboi
          </Link>
          <div className="topbar-right">
            <span className="preview-chip">
              <span />
              Local preview
            </span>
            <Link
              href="/admin/artworks/new"
              className="icon-button"
              aria-label="Add artwork"
            >
              <Plus size={20} />
            </Link>
            <button
              className="icon-button mobile-menu-button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </header>
        {open && (
          <nav
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Mobile navigation"
          >
            {navigation.map(({ href, label, Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                <Icon size={19} />
                {label}
              </Link>
            ))}
          </nav>
        )}
        <div className="preview-banner">
          <CircleHelp size={15} />
          <p>
            Preview workspace · Drafts stay in this browser. Use sample data
            until secure storage is connected.
          </p>
          <Link href="/admin/settings">
            Details <ArrowUpRight size={13} />
          </Link>
        </div>
        <main id="main-content" className="page-content">
          {error && (
            <div className="notice error" role="alert">
              {error} <Link href="/admin/settings">Manage saved preview</Link>
            </div>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          <span>SADBOI / STUDIO</span>
          <span>Foundation build · 01</span>
        </footer>
      </div>
    </div>
  );
}
