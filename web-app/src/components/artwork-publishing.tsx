"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import type { ArtworkAsset, GalleryInput, SharedArtwork } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";

export function ArtworkPublishing({
  artwork,
  assets: assetRecords,
  onSaved,
  detailsDirty = false,
  detailsSaving = false,
  onBusyChange,
}: {
  artwork: SharedArtwork;
  assets: ArtworkAsset[];
  onSaved: (art: SharedArtwork) => void;
  detailsDirty?: boolean;
  detailsSaving?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const assets = assetRecords.filter((asset) => !asset.removalPending);
  const saved = artwork.gallery;
  const [assetId, setAssetId] = useState(
    saved?.assetId ?? artwork.coverAssetId ?? assets[0]?.id ?? "",
  );
  const selectedAssetId = assets.some((asset) => asset.id === assetId)
    ? assetId
    : "";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const attempt = useRef({ payload: "", id: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || detailsSaving) return;
    const form = new FormData(event.currentTarget);
    const publishing =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !==
      "unpublish";
    if (publishing && detailsDirty) {
      setError("Save your artwork changes above before publishing them.");
      return;
    }
    const input: GalleryInput = {
      published: publishing,
      assetId: selectedAssetId || null,
      alt: String(form.get("galleryAlt") ?? ""),
      caption: String(form.get("galleryCaption") ?? ""),
      credits: String(form.get("galleryCredits") ?? ""),
      order: Number(form.get("galleryOrder")),
      rightsConfirmed: form.get("galleryRights") === "on",
    };
    const payload = JSON.stringify({ input, revision: artwork.revision });
    if (payload !== attempt.current.payload)
      attempt.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setMessage("");
    try {
      const data: { artwork: SharedArtwork } = await artworkRequest(
        `/api/artworks/${artwork.id}/gallery`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input,
            revision: artwork.revision,
            operationId: attempt.current.id,
          }),
        },
      );
      onSaved(data.artwork);
      attempt.current = { payload: "", id: "" };
      setMessage(
        publishing
          ? "Published to the gallery."
          : "Removed from the gallery. Your studio record and images are kept.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save publication. Your choices are ready to retry.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section
      id="artwork-gallery"
      className="form-section gallery-publishing"
      aria-labelledby="gallery-publishing-title"
    >
      <div className="form-section-heading">
        <span>GALLERY</span>
        <div>
          <h2 id="gallery-publishing-title">Public gallery</h2>
          <p>
            {saved?.published
              ? "This piece is published."
              : "This piece is private."}{" "}
            <Link className="text-link" href="/admin/how-to#gallery">
              Publishing guide
            </Link>
          </p>
        </div>
      </div>
      <p className="notice">
        Save artwork details above before publishing. The gallery shows the
        saved title, story, series, year, medium, and tags. Original files and
        studio notes stay private.
      </p>
      {(detailsDirty || detailsSaving) && (
        <p className="notice" role="status">
          {detailsSaving
            ? "Waiting for artwork details to finish saving."
            : "You have unsaved artwork changes. Save them before publishing."}{" "}
          <a className="text-link" href="#artwork-details">
            Return to artwork details ↑
          </a>
        </p>
      )}
      {saved?.published && artwork.revision !== saved.publishedRevision && (
        <p className="notice">
          Saved details have changed since publication. Choose Update gallery to
          publish them.
        </p>
      )}
      {!assets.length ? (
        <p>
          Upload an artwork image above to prepare this piece for the gallery.
        </p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy || detailsSaving}>
            <div className="field">
              <label htmlFor="gallery-image">Gallery image</label>
              <select
                id="gallery-image"
                value={selectedAssetId}
                onChange={(event) => setAssetId(event.target.value)}
              >
                <option value="">Choose an image</option>
                {assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </div>
            {selectedAssetId && (
              <Image
                className="gallery-publish-preview"
                src={`/api/artworks/${artwork.id}/assets/${selectedAssetId}`}
                alt="Selected gallery preview"
                width={320}
                height={320}
                unoptimized
              />
            )}
            <div className="field">
              <label htmlFor="gallery-alt">Image description (alt text)</label>
              <textarea
                id="gallery-alt"
                name="galleryAlt"
                defaultValue={saved?.alt ?? ""}
                maxLength={500}
                rows={3}
              />
              <p className="field-hint">
                Describe the image itself for visitors who cannot see it.
              </p>
            </div>
            <div className="field">
              <label htmlFor="gallery-caption">Image caption (optional)</label>
              <textarea
                id="gallery-caption"
                name="galleryCaption"
                defaultValue={saved?.caption ?? ""}
                maxLength={1000}
                rows={2}
              />
            </div>
            <div className="field">
              <label htmlFor="gallery-credits">Public credits (optional)</label>
              <textarea
                id="gallery-credits"
                name="galleryCredits"
                defaultValue={saved?.credits ?? ""}
                maxLength={1000}
                rows={2}
              />
            </div>
            <div className="field">
              <label htmlFor="gallery-order">Display order</label>
              <input
                id="gallery-order"
                name="galleryOrder"
                type="number"
                min={0}
                max={999999}
                step={1}
                defaultValue={saved?.order ?? 0}
              />
              <p className="field-hint">
                Lower numbers appear first. Ties show newer artwork first, then
                title.
              </p>
            </div>
            <label className="gallery-rights">
              <input
                type="checkbox"
                name="galleryRights"
                defaultChecked={saved?.rightsConfirmed ?? false}
              />{" "}
              I confirm this image, story, and credits may be displayed
              publicly.
            </label>
            <p className="field-hint">
              Publishing requires Ready for review status and Artist owned or
              Licensed work rights. Draft, Archived, or Needs review removes an
              already-published piece.
            </p>
            <div className="gallery-publish-actions">
              <button
                className="button primary"
                type="submit"
                value="publish"
                disabled={detailsDirty}
              >
                {busy
                  ? "Saving…"
                  : saved?.published
                    ? "Update gallery"
                    : "Publish to gallery"}
              </button>
              {saved?.published && (
                <button
                  className="button secondary"
                  type="submit"
                  value="unpublish"
                  formNoValidate
                >
                  Unpublish
                </button>
              )}
              {saved?.published && (
                <Link
                  className="text-link"
                  href={`/art/${saved.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View public artwork ↗
                </Link>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
