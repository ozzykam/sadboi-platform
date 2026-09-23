import { protectedBody, authResponse } from "@/server/auth-http";
import { artworkStaff, artworkFailure } from "@/server/artworks";
import { publishArtwork } from "@/server/gallery";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await artworkStaff(true);
    const body = await protectedBody(request, 16384);
    return authResponse({
      artwork: await publishArtwork((await params).id, body, staff),
    });
  } catch (error) {
    return artworkFailure(error);
  }
}
