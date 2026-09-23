import { authResponse, protectedBody } from "@/server/auth-http";
import {
  artworkFailure,
  artworkStaff,
  createArtwork,
  listArtwork,
} from "@/server/artworks";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const staff = await artworkStaff();
    return authResponse(
      await listArtwork(staff, new URL(request.url).searchParams.get("cursor")),
    );
  } catch (error) {
    return artworkFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await artworkStaff(true);
    const body = await protectedBody(request, 65536);
    return authResponse({ artwork: await createArtwork(body, staff) }, 201);
  } catch (error) {
    return artworkFailure(error);
  }
}
