"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageOff, LayoutGrid, Table2 } from "lucide-react";
import type { Artwork, SharedArtwork } from "@sadboi/core";
import { Badge } from "./ui";

export type ArtworkView = "table" | "grid";

export function ArtworkViewToggle({
  view,
  onChange,
}: {
  view: ArtworkView;
  onChange: (view: ArtworkView) => void;
}) {
  return (
    <div className="artwork-view-toggle" role="group" aria-label="Artwork view">
      <button
        type="button"
        className={`button ${view === "table" ? "primary" : "secondary"}`}
        aria-pressed={view === "table"}
        onClick={() => onChange("table")}
      >
        <Table2 size={16} aria-hidden="true" /> Table
      </button>
      <button
        type="button"
        className={`button ${view === "grid" ? "primary" : "secondary"}`}
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid size={16} aria-hidden="true" /> Grid
      </button>
    </div>
  );
}

type TableArtwork = Pick<
  Artwork,
  "id" | "title" | "series" | "year" | "medium" | "status" | "rights"
> &
  Partial<Pick<SharedArtwork, "coverAssetId" | "gallery" | "revision">>;

function ArtworkThumbnail({ art }: { art: TableArtwork }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="artwork-table-thumbnail">
      {art.coverAssetId && !failed ? (
        <Image
          src={`/api/artworks/${art.id}/assets/${art.coverAssetId}`}
          alt=""
          width={80}
          height={64}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="artwork-table-placeholder"
          role="img"
          aria-label={failed ? "Image unavailable" : "No preview image"}
        >
          <ImageOff size={22} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export function ArtworkTable({
  artworks,
  showGallery = false,
}: {
  artworks: TableArtwork[];
  showGallery?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="table-scroll inbox-table-wrap contacts-table-wrap">
      <table className="inbox-table contacts-table artwork-table">
        <caption className="sr-only">Artwork catalog</caption>
        <thead>
          <tr>
            <th scope="col">Preview</th>
            <th scope="col">Artwork</th>
            <th scope="col">Year</th>
            <th scope="col">Medium</th>
            <th scope="col">Status</th>
            <th scope="col">Rights</th>
            {showGallery && <th scope="col">Public gallery</th>}
          </tr>
        </thead>
        <tbody>
          {artworks.map((art) => (
            <tr
              key={art.id}
              onClick={(event) => {
                // Keep the title's native link behavior, including new-tab clicks.
                if (
                  (event.target as HTMLElement).closest("a") ||
                  window.getSelection()?.toString()
                )
                  return;
                router.push(`/admin/artworks/${art.id}`);
              }}
            >
              <td>
                <ArtworkThumbnail key={art.coverAssetId ?? art.id} art={art} />
              </td>
              <th scope="row" className="artwork-table-title">
                <Link href={`/admin/artworks/${art.id}`}>{art.title}</Link>
                <small>{art.series || "Independent work"}</small>
              </th>
              <td>{art.year}</td>
              <td>{art.medium}</td>
              <td>
                <Badge tone={art.status === "ready" ? "green" : "neutral"}>
                  {art.status}
                </Badge>
              </td>
              <td>
                {art.rights === "review"
                  ? "Rights review needed"
                  : art.rights === "owned"
                    ? "Artist owned"
                    : "Licensed work"}
              </td>
              {showGallery && (
                <td>
                  {art.gallery?.published ? (
                    <>
                      In public gallery
                      {art.revision !== art.gallery.publishedRevision && (
                        <small>Saved changes need publishing</small>
                      )}
                    </>
                  ) : (
                    "Private"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
