"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  galleryOrderSchema,
  type ArtworkPage,
  type SharedArtwork,
} from "@sadboi/core";
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
  const [orders, setOrders] = useState<
    Record<string, { value: string; revision: number }>
  >({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const orderAttempt = useRef<{ payload: string; operationId: string } | null>(
    null,
  );
  const orderSaving = useRef(false);
  function changeOrder(id: string, value: string) {
    const art = artworks.find((item) => item.id === id)!;
    setOrderMessage("");
    setError("");
    setOrders((current) => {
      const next = { ...current };
      if (value.trim() !== "" && Number(value) === art.gallery?.order)
        delete next[id];
      else
        next[id] = { value, revision: current[id]?.revision ?? art.revision };
      return next;
    });
  }
  async function saveOrder() {
    if (orderSaving.current) return;
    const parsed = galleryOrderSchema.safeParse(
      Object.entries(orders).map(([id, draft]) => ({
        id,
        revision: draft.revision,
        order: draft.value.trim() === "" ? NaN : Number(draft.value),
      })),
    );
    if (!parsed.success) {
      setError(
        "Enter a whole number from 0 to 999999 for each edited display order. Save up to 100 changes at a time.",
      );
      return;
    }
    const payload = JSON.stringify(parsed.data);
    if (orderAttempt.current?.payload !== payload)
      orderAttempt.current = { payload, operationId: crypto.randomUUID() };
    orderSaving.current = true;
    setSavingOrder(true);
    setError("");
    setOrderMessage("");
    try {
      const data: { artworks: SharedArtwork[] } = await artworkRequest(
        "/api/artworks/gallery-order",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: parsed.data,
            operationId: orderAttempt.current.operationId,
          }),
        },
      );
      setArtworks((current) =>
        current.map(
          (art) => data.artworks.find((saved) => saved.id === art.id) ?? art,
        ),
      );
      setOrders({});
      orderAttempt.current = null;
      setOrderMessage(
        "Display order saved. The public gallery now uses the updated order.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save display order. Your changes are still here; retry the save.",
      );
    } finally {
      orderSaving.current = false;
      setSavingOrder(false);
    }
  }
  const filtered = artworks.filter(
    (art) =>
      (art.title + " " + art.series + " " + art.tags.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || art.status === status) &&
      (rights === "all" || art.rights === rights),
  );
  if (canEdit)
    filtered.sort(
      (a, b) =>
        Number(Boolean(b.gallery?.published)) -
          Number(Boolean(a.gallery?.published)) ||
        (a.gallery?.order ?? 0) - (b.gallery?.order ?? 0) ||
        b.year - a.year ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
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
        <div className="artwork-results-actions">
          <span>PRIVATE STUDIO CATALOG</span>
          <ArtworkViewToggle view={view} onChange={setView} />
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="artwork-order-toolbar">
          <div>
            <p>
              Lower display-order numbers appear first in the public gallery.
            </p>
            <p className="field-hint">
              Edit published pieces in Table view, then save. Equal numbers use
              newest year, title, then ID. Changes remain pending across filters
              and views.
            </p>
            <span role="status">
              {orderMessage ||
                (Object.keys(orders).length
                  ? `${Object.keys(orders).length} unsaved display-order changes`
                  : "No unsaved display-order changes")}
            </span>
          </div>
          <div className="artwork-view-toggle">
            <button
              type="button"
              className="button secondary"
              disabled={savingOrder || !Object.keys(orders).length}
              onClick={() => {
                setOrders({});
                setError("");
                setOrderMessage("");
                orderAttempt.current = null;
              }}
            >
              Discard changes
            </button>
            <button
              type="button"
              className="button primary"
              disabled={savingOrder || busy || !Object.keys(orders).length}
              onClick={saveOrder}
            >
              {savingOrder ? "Saving display order…" : "Save display order"}
            </button>
          </div>
        </div>
      )}
      {filtered.length ? (
        view === "table" ? (
          <ArtworkTable
            artworks={filtered}
            showGallery={canEdit}
            orderEditor={
              canEdit
                ? {
                    values: orders,
                    disabled: savingOrder,
                    onChange: changeOrder,
                  }
                : undefined
            }
          />
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
        <button
          className="button secondary"
          disabled={busy || savingOrder}
          onClick={loadMore}
        >
          {busy ? "Loading…" : "Load more artwork"}
        </button>
      )}
    </>
  );
}
