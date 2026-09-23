import { imageResource, readInventoryImage } from "@/server/inventory-images";
import { inventoryFailure } from "@/server/inventory";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    if (!imageResource(resource))
      return Response.json({ error: "Not found." }, { status: 404 });
    return await readInventoryImage(resource, id);
  } catch (error) {
    return inventoryFailure(error);
  }
}
