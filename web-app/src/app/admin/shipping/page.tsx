import { ShippingSettingsEditor } from "@/components/shipping-settings";
import { shippingSettings } from "@/server/shipping";
import { requireStaff } from "@/server/staff";
export default async function ShippingPage() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  return <ShippingSettingsEditor initial={await shippingSettings()} canEdit={staff.role === "super_admin"} />;
}
