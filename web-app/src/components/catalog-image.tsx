"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useState } from "react";
import Image from "next/image";

type Props = {
  variant: "art" | "shop";
  src: string;
  alt: string;
  sizes: string;
  srcSet?: string;
  width?: number;
  height?: number;
};

export function CatalogImage(props: Props) {
  // A different image starts a fresh loading state, including in product dialogs.
  return (
    <ImageWithPlaceholder
      key={`${props.src}:${props.srcSet ?? ""}`}
      {...props}
    />
  );
}

function ImageWithPlaceholder({
  variant,
  src,
  alt,
  sizes,
  srcSet,
  width,
  height,
}: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Cached images can finish before React attaches its load handler.
    if (image?.complete) setState(image.naturalWidth ? "loaded" : "error");
  }, []);
  const handlers = {
    onLoad: () => setState("loaded"),
    onError: () => setState("error"),
  };
  return (
    <span
      className={`catalog-media catalog-media-${variant}`}
      data-state={state}
      style={
        variant === "art" && width && height
          ? { aspectRatio: `${width} / ${height}` }
          : undefined
      }
    >
      {state === "loading" && (
        <span
          className={`catalog-image-placeholder skeleton-surface skeleton-${variant}`}
          aria-hidden="true"
        >
          <span className="skeleton-object" />
        </span>
      )}
      {variant === "art" ? (
        <img
          ref={imageRef}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          width={width}
          height={height}
          alt={alt}
          loading="lazy"
          {...handlers}
        />
      ) : (
        <Image
          ref={imageRef}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="shop-product-photo"
          unoptimized
          {...handlers}
        />
      )}
      {state === "error" && (
        <span className="catalog-image-error">Image unavailable</span>
      )}
    </span>
  );
}
