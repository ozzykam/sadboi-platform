import { artworkFailure, artworkStaff } from "@/server/artworks";
import { readAsset } from "@/server/artwork-assets";
type Context = { params: Promise<{ id: string; assetId: string }> };
export const runtime = "nodejs";
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
