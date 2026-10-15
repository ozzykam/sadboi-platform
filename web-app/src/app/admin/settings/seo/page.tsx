import { SeoSettings } from "@/components/seo-settings";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
import { seoSettings } from "@/server/seo-settings";
export default async function Page() {
  if (getMode() !== "staff")
    return (
      <p className="notice">
        Website SEO settings are available when staff sign-in is enabled.
      </p>
    );
  await requireStaff(["super_admin"]);
  return (
    <SeoSettings
      initial={await seoSettings()}
      production={
        process.env.NODE_ENV === "production" &&
        (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production")
      }
    />
  );
}
