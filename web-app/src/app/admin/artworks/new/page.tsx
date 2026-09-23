import { ArtworkEditor } from "@/components/artwork-editor";
import { SharedArtworkEditor } from "@/components/shared-artwork-editor";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    await requireStaff(["super_admin"]);
    return <SharedArtworkEditor />;
  }
  return <ArtworkEditor />;
}
