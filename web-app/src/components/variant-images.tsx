"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { inventoryRequest } from "@/lib/inventory-client";

export function VariantImages({
  id,
  initial,
  onUploadingChange,
  onImagesChange,
}: {
  id: string;
  initial: string[];
  onUploadingChange: (busy: boolean) => void;
  onImagesChange: (assetIds: string[]) => void;
}) {
  const [images, setImages] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function upload(files: File[]) {
    if (lock.current || !files.length) return;
    setError("");
    setMessage("");
    if (files.length + images.length > 12) {
      setError("Choose fewer files. Each variation supports up to 12 images.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onUploadingChange(true);
    let saved = 0;
    try {
      for (const file of files) {
        setMessage(`Uploading ${saved + 1} of ${files.length}…`);
        const proof = await fetch("/api/auth/csrf", { cache: "no-store" });
        if (!proof.ok)
          throw new Error(
            "Could not verify your session. Refresh and try again.",
          );
        const { token } = await proof.json();
        const response = await fetch(
          `/api/inventory/images/variants/${id}?append=1`,
          {
            method: "POST",
            body: file,
            headers: { "Content-Type": file.type, "X-CSRF-Token": token },
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Upload failed.");
        setImages(data.image.assetIds);
        onImagesChange(data.image.assetIds);
        saved++;
      }
      setMessage(
        `${saved} ${saved === 1 ? "image" : "images"} saved. Save below applies the other variation details.`,
      );
    } catch (cause) {
      setMessage(
        saved ? `${saved} images saved before the upload stopped.` : "",
      );
      setError(
        `${cause instanceof Error ? cause.message : "Upload failed."} Reopen the variation to check its saved images before retrying.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onUploadingChange(false);
    }
  }
  async function updateImage(assetId: string, action: "cover" | "remove") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onUploadingChange(true);
    setError("");
    setMessage("");
    try {
      const result = await inventoryRequest(
        `/api/inventory/images/variants/${id}?asset=${encodeURIComponent(assetId)}`,
        { method: action === "cover" ? "PATCH" : "DELETE" },
      );
      setImages(result.image.assetIds);
      onImagesChange(result.image.assetIds);
      setMessage(
        action === "cover"
          ? "Cover image saved."
          : "Image removed from this variation.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update the image.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onUploadingChange(false);
    }
  }
  return (
    <div className="field inv-wide">
      <label htmlFor={`variant-images-${id}`}>Variation images</label>
      <input
        id={`variant-images-${id}`}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={busy || images.length >= 12}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void upload(files);
        }}
      />
      <p className="field-hint">
        Choose one or more JPEG, PNG, or WebP files, up to 12 MB each and 12
        images total. Images save immediately, in selection order. The first
        image is the cover. Use Set as cover to choose a different image; this
        saves immediately.
      </p>
      <div className="inv-variant-images">
        {images.map((assetId, index) => (
          <figure key={assetId}>
            <Image
              src={`/api/inventory/images/variants/${id}?asset=${encodeURIComponent(assetId)}`}
              alt={`Saved variation image ${index + 1}`}
              width={140}
              height={140}
              unoptimized
            />
            <figcaption>
              {index === 0 ? "Cover image" : `Image ${index + 1}`}
            </figcaption>
            {index > 0 && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void updateImage(assetId, "cover")}
                aria-label={`Set variation image ${index + 1} as cover`}
              >
                Set as cover
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void updateImage(assetId, "remove")}
              aria-label={`Remove variation image ${index + 1}`}
            >
              Remove
            </button>
          </figure>
        ))}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
