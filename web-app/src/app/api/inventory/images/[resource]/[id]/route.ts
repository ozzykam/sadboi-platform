import { inventoryFailure } from "@/server/inventory";
import {
  imageResource,
  uploadInventoryImage,
  readStaffInventoryImage,
  removeVariantImage,
} from "@/server/inventory-images";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    if (!imageResource(resource))
      return Response.json(
        { error: "Invalid image resource." },
        { status: 400 },
      );
    return await readStaffInventoryImage(
      resource,
      id,
      new URL(_request.url).searchParams.get("asset"),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    if (resource !== "variants")
      return Response.json(
        { error: "Variation images only." },
        { status: 400 },
      );
    return Response.json({
      image: await removeVariantImage(
        id,
        new URL(request.url).searchParams.get("asset") ?? "",
        request,
      ),
    });
  } catch (error) {
    return inventoryFailure(error);
  }
}
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
