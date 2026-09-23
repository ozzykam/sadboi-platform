import { Suspense } from "react";
import { ArtworkList } from "@/components/artwork-list";
import { SharedArtworkList } from "@/components/shared-artwork-list";
import { listArtwork } from "@/server/artworks";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    const staff = await requireStaff(["super_admin", "legal"]);
    return (
      <SharedArtworkList
        initial={await listArtwork(staff)}
        canEdit={staff.role === "super_admin"}
      />
    );
  }
  return (
    <Suspense fallback={<p role="status">Opening artwork…</p>}>
      <ArtworkList />
    </Suspense>
  );
}
