"use client";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { artworkUploadLimit, type ArtworkAsset } from "@sadboi/core";
import { artworkRequest } from "@/lib/artwork-client";
export function ArtworkAssets({
  artworkId,
  initial,
  canEdit,
  onUploaded,
}: {
  artworkId: string;
  initial: ArtworkAsset[];
  canEdit: boolean;
  onUploaded?: (asset: ArtworkAsset) => void;
}) {
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
            disabled={busy}
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
            disabled={busy || !file}
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
            <Image
              src={"/api/artworks/" + artworkId + "/assets/" + asset.id}
              alt={"Preview of " + asset.filename}
              width={800}
              height={600}
              unoptimized
              className="private-asset-image"
            />
            <div>
              <h3>{asset.filename}</h3>
              <p>
                {asset.width} × {asset.height} px ·{" "}
                {(asset.bytes / 1024 / 1024).toFixed(2)} MB
              </p>
              <p>Added {new Date(asset.createdAt).toLocaleDateString()}</p>
              {canEdit && (
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
