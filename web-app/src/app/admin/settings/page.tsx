import { Settings } from "@/components/settings";
import { Workspace } from "@/components/workspace";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
import { workspaceDirectory } from "@/server/workspace";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    await requireStaff(["super_admin"]);
    return <Workspace initial={await workspaceDirectory()} />;
  }
  return <Settings />;
}
