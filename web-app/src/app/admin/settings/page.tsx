import { Settings } from "@/components/settings";
import { Workspace } from "@/components/workspace";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
import { workspaceDirectory } from "@/server/workspace";
import Link from "next/link";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    await requireStaff(["super_admin"]);
    return (
      <>
        <section className="notice">
          <strong>Public website</strong>
          <p>Manage search visibility, homepage metadata and social sharing.</p>
          <Link className="button secondary" href="/admin/settings/seo">
            Search &amp; sharing settings
          </Link>
        </section>
        <Workspace initial={await workspaceDirectory()} />
      </>
    );
  }
  return <Settings />;
}
