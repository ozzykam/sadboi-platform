"use client";
import { useState } from "react";
import { InventoryPhoto } from "./inventory-photo";

export function InventoryImageGallery({
  id,
  assetIds,
  title,
}: {
  id: string;
  assetIds: string[];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <section className="inv-record-gallery" aria-label={`${title} images`}>
      <div className="inv-record-image">
        <InventoryPhoto
          resource="variants"
          id={id}
          assetId={assetIds[selected]}
          alt={`${title}${assetIds.length > 1 ? `, image ${selected + 1}` : ""}`}
        />
      </div>
      {assetIds.length > 1 && (
        <>
          <p className="field-hint" aria-live="polite">
            Image {selected + 1} of {assetIds.length}
            {selected === 0 ? " · Cover image" : ""}
          </p>
          <div className="inv-record-thumbnails">
            {assetIds.map((assetId, index) => (
              <button
                key={assetId}
                type="button"
                aria-label={`Show image ${index + 1}${index === 0 ? " (cover)" : ""}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <InventoryPhoto
                  resource="variants"
                  id={id}
                  assetId={assetId}
                  alt=""
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
