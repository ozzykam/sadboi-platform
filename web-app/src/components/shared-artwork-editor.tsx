"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArtworkAsset, ArtworkInput, SharedArtwork } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";
import { ArtworkForm } from "./artwork-editor";
import { ArtworkAssets } from "./artwork-assets";
import { ArtworkPublishing } from "./artwork-publishing";
import { Badge, PageHeading } from "./ui";
export function SharedArtworkEditor({
  initial,
  assets = [],
  canEdit = true,
}: {
  initial?: SharedArtwork;
  assets?: ArtworkAsset[];
  canEdit?: boolean;
}) {
  const router = useRouter(),
    [artwork, setArtwork] = useState(initial);
  const [currentAssets, setCurrentAssets] = useState(assets);
  const operation = useRef(""),
    lastPayload = useRef("");
  async function save(input: ArtworkInput) {
    const encoded = JSON.stringify(input);
    if (lastPayload.current !== encoded) {
      operation.current = crypto.randomUUID();
      lastPayload.current = encoded;
    }
    const data: { artwork: SharedArtwork } = await artworkRequest(
      artwork ? "/api/artworks/" + artwork.id : "/api/artworks",
      {
        method: artwork ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          operationId: operation.current,
          ...(artwork ? { revision: artwork.revision } : {}),
        }),
      },
    );
    if (!artwork) {
      router.replace("/admin/artworks/" + data.artwork.id);
      router.refresh();
    } else setArtwork(data.artwork);
    operation.current = "";
    lastPayload.current = "";
  }
  if (!canEdit && artwork)
    return (
      <>
        <Link href="/admin/artworks" className="back-link">
          All artwork
        </Link>
        <PageHeading
          eyebrow="ARTWORK / DETAILS"
          title={artwork.title}
          description={artwork.series || "Independent work"}
        />
        <div className="form-section">
          <Badge>{artwork.status}</Badge>
          <p>
            {artwork.year} · {artwork.medium}
          </p>
          <p className="preserve-lines">{artwork.description}</p>
          <p>Rights: {artwork.rights}</p>
          <p>{artwork.tags.join(", ")}</p>
          <p>
            {artwork.pixelWidth && artwork.pixelHeight
              ? artwork.pixelWidth + " × " + artwork.pixelHeight + " px"
              : "Dimensions not recorded"}{" "}
            · {artwork.colorProfile || "Color profile not recorded"}
          </p>
        </div>
        <ArtworkAssets
          artworkId={artwork.id}
          initial={assets}
          canEdit={false}
        />
      </>
    );
  return (
    <>
      <ArtworkForm
        artwork={
          artwork
            ? { ...artwork, internalNotes: artwork.internalNotes ?? "" }
            : undefined
        }
        variants={0}
        onSave={save}
      />
      {artwork ? (
        <>
          <ArtworkAssets
            artworkId={artwork.id}
            initial={assets}
            canEdit
            onUploaded={(asset) =>
              setCurrentAssets((current) => [
                asset,
                ...current.filter((item) => item.id !== asset.id),
              ])
            }
          />
          <ArtworkPublishing
            artwork={artwork}
            assets={currentAssets}
            onSaved={setArtwork}
          />
        </>
      ) : (
        <p className="notice">Save the artwork first, then add its images.</p>
      )}
    </>
  );
}
