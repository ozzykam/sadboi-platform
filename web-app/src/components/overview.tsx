"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  GalleryVerticalEnd,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useDrafts } from "@/lib/draft-store";
import { ArtworkMark, Badge, PageHeading } from "./ui";

export function Overview() {
  const { catalog, ready } = useDrafts();
  const needsReview = catalog.artworks.filter(
    (art) => art.rights === "review",
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="THE STUDIO, IN VIEW"
        title="Make room for the work."
        description="Your artwork, its possibilities, and the details that keep it moving."
        action={
          <Link className="button primary" href="/admin/artworks/new">
            <Plus size={17} />
            Add artwork
          </Link>
        }
      />
      <section className="intro-panel">
        <div>
          <span className="section-number">01 / THE FOUNDATION</span>
          <h2>It starts with the art.</h2>
          <p>
            Build an archive once. Connect each work to prints, collections,
            commissions, and licenses as your studio grows.
          </p>
          <Link href="/admin/artworks">
            Open your archive <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="intro-monogram" aria-hidden="true">
          <span>S</span>
          <i />
          <b>WORK / EDITION / STORY</b>
        </div>
      </section>
      <div className="stat-grid">
        {[
          {
            label: "Artworks",
            value: catalog.artworks.length,
            note: "In your local archive",
            href: "/admin/artworks",
          },
          {
            label: "Ready for review",
            value: catalog.artworks.filter((a) => a.status === "ready").length,
            note: "Prepared for the next step",
            href: "/admin/artworks?status=ready",
          },
          {
            label: "Print variants",
            value: catalog.variants.length,
            note: "Linked to original works",
            href: "/admin/inventory",
          },
          {
            label: "Rights to review",
            value: needsReview,
            note: "Check before publication",
            href: "/admin/artworks?rights=review",
          },
        ].map((stat) => (
          <Link href={stat.href} className="stat-card" key={stat.label}>
            <span>
              {stat.label}
              <ArrowUpRight size={15} />
            </span>
            <strong>
              {ready ? stat.value.toString().padStart(2, "0") : "—"}
            </strong>
            <small>{stat.note}</small>
          </Link>
        ))}
      </div>
      <div className="overview-columns">
        <section>
          <div className="section-heading">
            <h2>From the archive</h2>
            <Link href="/admin/artworks">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {catalog.artworks.length ? (
            <div className="recent-list">
              {catalog.artworks.slice(0, 3).map((art) => (
                <Link
                  className="recent-art"
                  href={`/admin/artworks/${art.id}`}
                  key={art.id}
                >
                  <ArtworkMark title={art.title} />
                  <div>
                    <strong>{art.title}</strong>
                    <span>
                      {art.medium} · {art.year}
                    </span>
                  </div>
                  <Badge tone={art.status === "ready" ? "green" : "neutral"}>
                    {art.status}
                  </Badge>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <GalleryVerticalEnd size={29} strokeWidth={1.3} />
              <h3>Your archive begins here.</h3>
              <p>
                Add a title, a few details, and the story behind your first
                work.
              </p>
              <Link href="/admin/artworks/new" className="button secondary">
                <Plus size={16} />
                Add your first artwork
              </Link>
            </div>
          )}
        </section>
        <section className="next-panel">
          <p className="eyebrow">BUILDING THE STUDIO</p>
          <h2>One connected workspace.</h2>
          <ul>
            <li>
              <Check size={17} />
              <div>
                Artwork & catalog<small>Explore the working preview</small>
              </div>
            </li>
            <li>
              <Circle size={15} />
              <div>
                Secure shared access
                <small>Next: Firebase and staff permissions</small>
              </div>
            </li>
            <li>
              <Circle size={15} />
              <div>
                Production & commerce
                <small>Then: stock, orders, and payments</small>
              </div>
            </li>
          </ul>
          <Link href="/admin/settings">
            <ShieldCheck size={16} />
            See workspace status <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
