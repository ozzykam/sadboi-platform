import { inventoryFailure } from "@/server/inventory";
import { imageResource, uploadInventoryImage } from "@/server/inventory-images";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    if (!imageResource(resource))
      return Response.json(
        { error: "Invalid image resource." },
        { status: 400 },
      );
    return Response.json(
      { image: await uploadInventoryImage(resource, id, request) },
      { status: 201 },
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
