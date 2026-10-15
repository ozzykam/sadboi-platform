// The upload path is authoritative. Older metadata saves may have dropped or
// restored a stale input.imageAssetId even though the uploaded file still exists.
type ImageData = {
  imagePath?: string;
  input?: { imageAssetId?: string };
  catalogImages?: Array<{ assetId: string; path: string }>;
};
export function inventoryImages(data: ImageData) {
  if (Array.isArray(data.catalogImages)) return data.catalogImages;
  const assetId =
    data.imagePath?.match(/\/([a-f0-9-]{36})\.webp$/)?.[1] ??
    data.input?.imageAssetId;
  return assetId && data.imagePath ? [{ assetId, path: data.imagePath }] : [];
}
export function inventoryImageAssetId(data: ImageData) {
  if (Array.isArray(data.catalogImages)) return data.catalogImages[0]?.assetId;
  return (
    data.imagePath?.match(/\/([a-f0-9-]{36})\.webp$/)?.[1] ??
    data.input?.imageAssetId
  );
}
