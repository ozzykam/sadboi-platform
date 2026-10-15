import type { Artwork } from "./catalog";
import type { GallerySettings } from "./gallery";
export type SharedArtwork = Omit<Artwork, "internalNotes"> & {
  internalNotes?: string;
  revision: number;
  coverAssetId: string | null;
  gallery?: GallerySettings;
};
export type ArtworkAsset = {
  removalPending?: boolean;
  id: string;
  filename: string;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
};
export type ArtworkPage = {
  artworks: SharedArtwork[];
  nextCursor: string | null;
};
export const artworkUploadLimit = 30 * 1024 * 1024;
