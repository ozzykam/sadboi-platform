import { galleryImage } from "@/server/gallery";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const width = Number(new URL(request.url).searchParams.get("w") ?? 1600);
    if (![480, 960, 1600].includes(width))
      return new Response("Invalid image size.", {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    return await galleryImage((await params).id, width);
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return new Response(
      status === 404 ? "Image not found." : "Image temporarily unavailable.",
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
