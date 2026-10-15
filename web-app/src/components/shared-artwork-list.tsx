"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { ArtworkPage } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";
import { ArtworkMark, Badge, PageHeading } from "./ui";
import {
  ArtworkTable,
  ArtworkViewToggle,
  type ArtworkView,
} from "./artwork-table";
export function SharedArtworkList({
  initial,
  canEdit,
}: {
  initial: ArtworkPage;
  canEdit: boolean;
}) {
  const [artworks, setArtworks] = useState(initial.artworks),
    [cursor, setCursor] = useState(initial.nextCursor);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [rights, setRights] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<ArtworkView>("table");
  const filtered = artworks.filter(
    (art) =>
      (art.title + " " + art.series + " " + art.tags.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || art.status === status) &&
      (rights === "all" || art.rights === rights),
  );
  async function loadMore() {
    setBusy(true);
    setError("");
    try {
      const data: ArtworkPage = await artworkRequest(
        "/api/artworks?cursor=" + cursor,
      );
      setArtworks((current) => [
        ...current,
        ...data.artworks.filter(
          (art) => !current.some((old) => old.id === art.id),
        ),
      ]);
      setCursor(data.nextCursor);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load artwork.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ARTWORK / STUDIO ARCHIVE"
        title="The body of work."
        description="One shared home for originals, their stories, and the files behind them."
        action={
          canEdit ? (
            <Link className="button primary" href="/admin/artworks/new">
              Add artwork
            </Link>
          ) : undefined
        }
      />
      <div className="catalog-toolbar">
        <label className="search-field">
          <span className="sr-only">Search loaded artwork</span>
          <input
            type="search"
            placeholder="Search loaded titles, series, or tags"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="filter-group">
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Rights</span>
            <select value={rights} onChange={(e) => setRights(e.target.value)}>
              <option value="all">All rights</option>
              <option value="review">Needs review</option>
              <option value="owned">Artist owned</option>
              <option value="licensed">Licensed work</option>
            </select>
          </label>
        </div>
      </div>
      <div className="results-line">
        <span aria-live="polite">
          {filtered.length} matching / {artworks.length} loaded
          {cursor ? " · More available" : ""}
        </span>
        <ArtworkViewToggle view={view} onChange={setView} />
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {filtered.length ? (
        view === "table" ? (
          <ArtworkTable artworks={filtered} showGallery={canEdit} />
        ) : (
          <div className="artwork-grid">
            {filtered.map((art) => (
              <Link
                className="artwork-card"
                href={"/admin/artworks/" + art.id}
                key={art.id}
              >
                <div className="artwork-card-image">
                  {art.coverAssetId ? (
                    <Image
                      src={
                        "/api/artworks/" +
                        art.id +
                        "/assets/" +
                        art.coverAssetId
                      }
                      alt={art.title}
                      width={640}
                      height={640}
                      unoptimized
                      className="private-artwork-image"
                    />
                  ) : (
                    <ArtworkMark title={art.title} large />
                  )}
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
                {canEdit && (
                  <p className="field-hint">
                    {art.gallery?.published
                      ? art.revision !== art.gallery.publishedRevision
                        ? "In gallery · Saved changes need publishing"
                        : "In public gallery"
                      : "Private · Not in gallery"}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="empty-state roomy">
          <h2>
            {artworks.length
              ? "No matching artwork."
              : "Every collection has a first work."}
          </h2>
          <p>
            {artworks.length
              ? "Try another filter or load more artwork."
              : "Create a record, then add the original image and its private preview."}
          </p>
          {canEdit && !artworks.length && (
            <Link href="/admin/artworks/new" className="button secondary">
              Add the first artwork
            </Link>
          )}
        </div>
      )}
      {cursor && (
        <button className="button secondary" disabled={busy} onClick={loadMore}>
          {busy ? "Loading…" : "Load more artwork"}
        </button>
      )}
    </>
  );
}
