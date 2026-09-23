"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import type { PublicArtwork } from "@sadboi/core";
export function ArtworkViewer({ work }: { work: PublicArtwork }) {
  const dialog = useRef<HTMLDialogElement>(null),
    [zoomed, setZoomed] = useState(false);
  const src = `/api/gallery/images/${work.id}?w=1600`;
  return (
    <>
      <button
        type="button"
        className="artwork-viewer-trigger"
        aria-label={`Enlarge ${work.title}`}
        onClick={() => {
          setZoomed(false);
          dialog.current?.showModal();
        }}
      >
        <img
          src={src}
          width={work.width}
          height={work.height}
          alt={work.alt}
          fetchPriority="high"
        />
        <span>View larger ↗</span>
      </button>
      <dialog
        ref={dialog}
        className="artwork-lightbox"
        aria-label={`${work.title} — enlarged image`}
      >
        <div className="artwork-lightbox-toolbar">
          <span>{work.title}</span>
          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            aria-pressed={zoomed}
          >
            {zoomed ? "Fit image" : "Zoom in"}
          </button>
          <button
            autoFocus
            type="button"
            onClick={() => dialog.current?.close()}
          >
            Close ✕
          </button>
        </div>
        <div className={`artwork-lightbox-image${zoomed ? " is-zoomed" : ""}`}>
          <img
            src={src}
            width={work.width}
            height={work.height}
            alt={work.alt}
          />
        </div>
      </dialog>
    </>
  );
}
