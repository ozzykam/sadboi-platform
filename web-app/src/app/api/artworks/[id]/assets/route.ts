import { authResponse, validateMutation } from "@/server/auth-http";
import { artworkFailure, artworkStaff } from "@/server/artworks";
import { listAssets, uploadAsset } from "@/server/artwork-assets";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(_request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff();
    return authResponse({ assets: await listAssets((await params).id, staff) });
  } catch (error) {
    return artworkFailure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff(true);
    await validateMutation(request);
    return authResponse(
      { asset: await uploadAsset((await params).id, request, staff) },
      201,
    );
  } catch (error) {
    return artworkFailure(error);
  }
}
