import { artworkStaff, artworkFailure } from "@/server/artworks";
import { authResponse, protectedBody } from "@/server/auth-http";
import {
  listShopCollections,
  saveShopCollection,
} from "@/server/shop-collections";
export const runtime = "nodejs";
export async function GET() {
  try {
    return authResponse({
      collections: await listShopCollections(await artworkStaff(true)),
    });
  } catch (error) {
    return artworkFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await artworkStaff(true);
    return authResponse({
      collection: await saveShopCollection(
        await protectedBody(request, 65536),
        staff,
      ),
    });
  } catch (error) {
    return artworkFailure(error);
  }
}
