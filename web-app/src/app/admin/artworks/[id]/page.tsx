import { ArtworkEditor } from "@/components/artwork-editor";
import { SharedArtworkEditor } from "@/components/shared-artwork-editor";
import { getArtwork } from "@/server/artworks";
import { listAssets } from "@/server/artwork-assets";
import { AccessError } from "@/server/staff";
import { notFound } from "next/navigation";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    const staff = await requireStaff(["super_admin", "legal"]),
      { id } = await params;
    const [artwork, assets] = await Promise.all([
      getArtwork(id, staff),
      listAssets(id, staff),
    ]).catch((error) => {
      if (error instanceof AccessError && error.status === 404) notFound();
      throw error;
    });
    return (
      <SharedArtworkEditor
        initial={artwork}
        assets={assets}
        canEdit={staff.role === "super_admin"}
      />
    );
  }
  const { id } = await params;
  return <ArtworkEditor id={id} />;
}
