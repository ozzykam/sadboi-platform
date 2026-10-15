// Preserve older preview links while using the supplied public artwork.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: "/images/shared-image.webp" },
  });
}
