import { authResponse, protectedBody } from "@/server/auth-http";
import {
  artworkFailure,
  artworkStaff,
  getArtwork,
  updateArtwork,
} from "@/server/artworks";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff();
    return authResponse({
      artwork: await getArtwork((await params).id, staff),
    });
  } catch (error) {
    return artworkFailure(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const staff = await artworkStaff(true);
    const body = await protectedBody(request, 65536);
    return authResponse({
      artwork: await updateArtwork((await params).id, body, staff),
    });
  } catch (error) {
    return artworkFailure(error);
  }
}
