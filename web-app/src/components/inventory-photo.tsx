"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

type Props = {
  resource: "products" | "variants";
  id: string;
  assetId?: string;
  alt: string;
};
export function InventoryPhoto(props: Props) {
  return <Photo key={`${props.id}:${props.assetId}`} {...props} />;
}
function Photo({ resource, id, assetId, alt }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  return (
    <span className="inv-photo" data-state={assetId ? state : "empty"}>
      {assetId && state !== "error" ? (
        <>
          {state === "loading" && (
            <span
              className="inv-photo-loading skeleton-surface"
              aria-hidden="true"
            />
          )}
          <Image
            src={`/api/inventory/images/${resource}/${id}?asset=${encodeURIComponent(assetId)}`}
            alt={alt}
            fill
            unoptimized
            sizes="(max-width: 680px) 100vw, 400px"
            onLoad={() => setState("loaded")}
            onError={() => setState("error")}
          />
        </>
      ) : (
        <span className="inv-photo-empty">
          <ImageIcon size={32} strokeWidth={1.25} aria-hidden="true" />
          <span>{assetId ? "Image unavailable" : "No image yet"}</span>
        </span>
      )}
    </span>
  );
}
