"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  GalleryVerticalEnd,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useDrafts } from "@/lib/draft-store";
import { ArtworkMark, Badge, PageHeading } from "./ui";

export function ArtworkList() {
  const { catalog, ready } = useDrafts();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [rights, setRights] = useState(params.get("rights") ?? "all");
  const filtered = catalog.artworks.filter(
    (art) =>
      `${art.title} ${art.series} ${art.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || art.status === status) &&
      (rights === "all" || art.rights === rights),
  );
  return (
    <>
      <PageHeading
        eyebrow="ART & PRODUCTS / ARCHIVE"
        title="The body of work."
        description="An original record for every piece. Everything else connects here."
        action={
          <Link href="/admin/artworks/new" className="button primary">
            <Plus size={17} />
            Add artwork
          </Link>
        }
      />
      <div className="catalog-toolbar">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search artwork</span>
          <input
            type="search"
            placeholder="Search titles, series, or tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="filter-group">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <label>
            <span className="sr-only">Artwork status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Artwork rights</span>
            <select value={rights} onChange={(e) => setRights(e.target.value)}>
              <option value="all">All rights</option>
              <option value="owned">Artist owned</option>
              <option value="licensed">Licensed work</option>
              <option value="review">Needs review</option>
            </select>
          </label>
        </div>
      </div>
      <div className="results-line">
        <span aria-live="polite">
          {ready
            ? `${filtered.length} ${filtered.length === 1 ? "work" : "works"}`
            : "Opening archive…"}
        </span>
        <span>LOCAL DRAFT CATALOG</span>
      </div>
      {filtered.length ? (
        <div className="artwork-grid">
          {filtered.map((art, index) => (
            <Link
              href={`/admin/artworks/${art.id}`}
              className="artwork-card"
              key={art.id}
            >
              <div className="artwork-card-image">
                <ArtworkMark title={art.title} large />
                <span className="artwork-index">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span className="artwork-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="artwork-card-info">
                <div>
                  <h2>{art.title}</h2>
                  <p>
                    {art.series || "Independent work"} · {art.year}
                  </p>
                </div>
                <Badge tone={art.status === "ready" ? "green" : "neutral"}>
                  {art.status}
                </Badge>
              </div>
              <div className="artwork-card-footer">
                <span>{art.medium}</span>
                <span>
                  {art.rights === "review"
                    ? "Rights review needed"
                    : art.rights === "owned"
                      ? "Artist owned"
                      : "Licensed work"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state roomy">
          <GalleryVerticalEnd size={34} strokeWidth={1.2} />
          <h2>
            {catalog.artworks.length
              ? "No matching works."
              : "Every collection has a first work."}
          </h2>
          <p>
            {catalog.artworks.length
              ? "Try another title, status, or rights filter."
              : "Start a record for an artwork, or load fictional examples in Workspace."}
          </p>
          <Link
            className="button secondary"
            href={
              catalog.artworks.length
                ? "/admin/artworks/new"
                : "/admin/settings"
            }
          >
            {catalog.artworks.length ? "Add artwork" : "Explore sample catalog"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
