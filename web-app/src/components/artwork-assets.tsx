"use client";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { artworkUploadLimit, type ArtworkAsset } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";
import { useRouter } from "next/navigation";
export function ArtworkAssets({
  artworkId,
  initial,
  canEdit,
  onUploaded,
  onAssetsChanged,
  publishedAssetId,
  removalDisabled = false,
  onRemovalBusy,
}: {
  artworkId: string;
  initial: ArtworkAsset[];
  canEdit: boolean;
  onUploaded?: (asset: ArtworkAsset) => void;
  onAssetsChanged?: (assets: ArtworkAsset[]) => void;
  publishedAssetId?: string | null;
  removalDisabled?: boolean;
  onRemovalBusy?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const removalDialog = useRef<HTMLDialogElement>(null);
  const [removing, setRemoving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ArtworkAsset | null>(null);
  const [removeError, setRemoveError] = useState("");
  const removalOperation = useRef("");
  const removalLock = useRef(false);
  const [assets, setAssets] = useState(initial),
    [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const operation = useRef(""),
    input = useRef<HTMLInputElement>(null);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    if (file.size > artworkUploadLimit) {
      setError("Choose an image no larger than 30 MB.");
      return;
    }
    operation.current ||= crypto.randomUUID();
    setBusy(true);
    try {
      const type =
        file.type ||
        (/\.tiff?$/i.test(file.name)
          ? "image/tiff"
          : "application/octet-stream");
      const data: { asset: ArtworkAsset } = await artworkRequest(
        "/api/artworks/" + artworkId + "/assets",
        {
          method: "POST",
          headers: {
            "Content-Type": type,
            "X-File-Name": encodeURIComponent(file.name),
            "X-Upload-ID": operation.current,
          },
          body: file,
        },
      );
      setAssets((current) => [
        data.asset,
        ...current.filter((asset) => asset.id !== data.asset.id),
      ]);
      setFile(null);
      onUploaded?.(data.asset);
      operation.current = "";
      if (input.current) input.current.value = "";
      setMessage(
        "Original and private preview saved. The newest image now appears in the artwork catalog.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The upload failed. Your selected file is ready to retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeImage() {
    if (!removeTarget || removalLock.current || removalDisabled || busy) return;
    removalLock.current = true;
    setRemoving(true);
    onRemovalBusy?.(true);
    setRemoveError("");
    setMessage("");
    removalOperation.current ||= crypto.randomUUID();
    try {
      await artworkRequest(
        `/api/artworks/${artworkId}/assets/${removeTarget.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId: removalOperation.current }),
        },
      );
      const remaining = assets.filter((asset) => asset.id !== removeTarget.id);
      setAssets(remaining);
      onAssetsChanged?.(remaining.filter((asset) => !asset.removalPending));
      removalDialog.current?.close();
      setRemoveTarget(null);
      setMessage("Image removed. Its original and preview files were deleted.");
      router.refresh();
    } catch (error) {
      setRemoveError(
        error instanceof Error
          ? error.message
          : "Removal could not be completed. Retry removal.",
      );
      // A failed response may follow a committed removal. Refresh availability,
      // but keep the confirmation open so the same action can be retried.
      try {
        const data: { assets: ArtworkAsset[] } = await artworkRequest(
          `/api/artworks/${artworkId}/assets`,
        );
        setAssets(data.assets);
        onAssetsChanged?.(data.assets.filter((asset) => !asset.removalPending));
      } catch {
        /* Keep the current list and retry action if refresh also fails. */
      }
    } finally {
      removalLock.current = false;
      setRemoving(false);
      onRemovalBusy?.(false);
    }
  }
  return (
    <section className="asset-section">
      <div className="form-section-heading">
        <span>IMAGES</span>
        <div>
          <h2>Originals & previews</h2>
          <p>
            Every upload keeps its private original. Choose a display image
            separately in Public gallery.
          </p>
        </div>
      </div>
      {canEdit && (
        <form onSubmit={upload} className="asset-upload">
          <label htmlFor="artwork-file">Add an artwork image</label>
          <input
            ref={input}
            id="artwork-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff,.tif,.tiff"
            disabled={busy || removing}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              operation.current = "";
              setError("");
            }}
          />
          <p className="field-hint">
            JPEG, PNG, WebP, or single-image TIFF · up to 30 MB and 100
            megapixels. PSD files are not supported yet.
          </p>
          <button
            className="button primary"
            type="submit"
            disabled={busy || removing || !file}
            aria-busy={busy}
          >
            {busy ? "Uploading & preparing preview…" : "Upload image"}
          </button>
          {busy && (
            <p role="status">Keep this page open until the upload finishes.</p>
          )}
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
      {!assets.length && <p className="subtitle">No images yet.</p>}
      <div className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.id}>
            {asset.removalPending ? (
              <p className="notice">
                Removal pending. Retry to finish deleting the files.
              </p>
            ) : (
              <Image
                src={"/api/artworks/" + artworkId + "/assets/" + asset.id}
                alt={"Preview of " + asset.filename}
                width={800}
                height={600}
                unoptimized
                className="private-asset-image"
              />
            )}
            <div>
              <h3>{asset.filename}</h3>
              <p>
                {asset.width} × {asset.height} px ·{" "}
                {(asset.bytes / 1024 / 1024).toFixed(2)} MB
              </p>
              <p>Added {new Date(asset.createdAt).toLocaleDateString()}</p>
              {canEdit && !asset.removalPending && (
                <a
                  className="button secondary"
                  href={
                    "/api/artworks/" +
                    artworkId +
                    "/assets/" +
                    asset.id +
                    "?download=1"
                  }
                >
                  Download original
                </a>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || removing || removalDisabled}
                  aria-label={`${asset.removalPending ? "Retry removal of" : "Remove image"} ${asset.filename}`}
                  onClick={() => {
                    setRemoveTarget(asset);
                    setRemoveError("");
                    removalOperation.current = "";
                    removalDialog.current?.showModal();
                  }}
                >
                  {asset.removalPending ? "Retry removal" : "Remove image"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {canEdit && (
        <dialog
          ref={removalDialog}
          className="contact-detail-dialog asset-removal-dialog"
          aria-labelledby="asset-removal-title"
          onCancel={(event) => {
            if (removing) event.preventDefault();
          }}
        >
          <h2 id="asset-removal-title">Remove image?</h2>
          <p className="preserve-lines">{removeTarget?.filename}</p>
          <p>
            This permanently deletes the original and its preview. Download the
            original first if you need a copy. The artwork record stays in the
            catalog.
          </p>
          {removeTarget?.id === publishedAssetId && (
            <p className="notice">
              This image is in the public gallery. Cancel, then choose a
              replacement and Update gallery, or Unpublish the artwork, before
              removing it.
            </p>
          )}
          {removeError && (
            <p role="alert" className="notice error">
              {removeError}
            </p>
          )}
          <div className="asset-removal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={removing}
              onClick={() => removalDialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button primary"
              disabled={
                removing ||
                removalDisabled ||
                removeTarget?.id === publishedAssetId
              }
              onClick={removeImage}
            >
              {removing
                ? "Removing…"
                : removeError || removeTarget?.removalPending
                  ? "Retry removal"
                  : "Permanently remove image"}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
