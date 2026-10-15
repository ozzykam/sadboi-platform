import { authResponse, protectedBody } from "@/server/auth-http";
import { contactsStaff } from "@/server/contacts";
import { AccessError } from "@/server/staff";
import { inventoryFailure } from "@/server/inventory";
import { seoSettings, saveSeoSettings } from "@/server/seo-settings";
export const runtime = "nodejs";
async function seoStaff() {
  const staff = await contactsStaff();
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can manage website SEO.",
    );
  return staff;
}
export async function GET() {
  try {
    await seoStaff();
    return authResponse(await seoSettings());
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await seoStaff();
    return authResponse(
      await saveSeoSettings(await protectedBody(request), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
