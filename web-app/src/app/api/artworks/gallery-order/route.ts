import { authResponse, protectedBody } from "@/server/auth-http";
import { artworkFailure, artworkStaff } from "@/server/artworks";
import { saveGalleryOrder } from "@/server/gallery-order";

export const runtime = "nodejs";
export async function PATCH(request: Request) {
  try {
    const staff = await artworkStaff(true);
    const body = await protectedBody(request, 32768);
    return authResponse({ artworks: await saveGalleryOrder(body, staff) });
  } catch (error) {
    return artworkFailure(error);
  }
}
