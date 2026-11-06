import { authResponse, protectedBody } from "@/server/auth-http";
import { contactsStaff } from "@/server/contacts";
import { inventoryFailure } from "@/server/inventory";
import {
  studioInvoiceDetail,
  studioInvoiceDirectory,
  saveStudioInvoice,
} from "@/server/studio-invoices";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const staff = await contactsStaff(),
      id = new URL(request.url).searchParams.get("id");
    return authResponse(
      id
        ? await studioInvoiceDetail(id, staff)
        : await studioInvoiceDirectory(staff),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await contactsStaff();
    return authResponse(
      await saveStudioInvoice(await protectedBody(request, 65536), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
