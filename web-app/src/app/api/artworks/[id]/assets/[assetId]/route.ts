import { artworkFailure, artworkStaff } from "@/server/artworks";
import { readAsset } from "@/server/artwork-assets";
import { authResponse, protectedBody } from "@/server/auth-http";
import { removeArtworkImage } from "@/server/artwork-image-removal";
type Context = { params: Promise<{ id: string; assetId: string }> };
export const runtime = "nodejs";
export async function DELETE(request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff(true);
    const body = await protectedBody(request, 2048);
    const { id, assetId } = await params;
    return authResponse(await removeArtworkImage(id, assetId, body, staff));
  } catch (error) {
    return artworkFailure(error);
  }
}
export async function GET(request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff(),
      { id, assetId } = await params;
    return await readAsset(
      id,
      assetId,
      new URL(request.url).searchParams.get("download") === "1",
      staff,
    );
  } catch (error) {
    return artworkFailure(error);
  }
}
