import { authResponse, protectedBody } from "@/server/auth-http";
import { contactsStaff } from "@/server/contacts";
import { inventoryFailure } from "@/server/inventory";
import { invoiceDefaults, saveInvoiceDefaults } from "@/server/studio-invoices";
export const runtime = "nodejs";
export async function GET() {
  try {
    return authResponse(await invoiceDefaults(await contactsStaff()));
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await contactsStaff();
    return authResponse(
      await saveInvoiceDefaults(await protectedBody(request, 32768), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
