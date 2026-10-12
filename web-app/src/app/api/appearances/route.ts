import { publicAppearances } from "@/server/events";
import { inventoryFailure } from "@/server/inventory";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      { appearances: await publicAppearances() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
