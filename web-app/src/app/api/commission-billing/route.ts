import { authResponse, protectedBody } from "@/server/auth-http";
import { contactsStaff } from "@/server/contacts";
import { inventoryFailure } from "@/server/inventory";
import {
  commissionBillingDetail,
  saveCommissionBilling,
} from "@/server/commission-billing";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return authResponse(
      await commissionBillingDetail(
        new URL(request.url).searchParams.get("proposalId"),
        await contactsStaff(),
      ),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await contactsStaff();
    return authResponse(
      await saveCommissionBilling(await protectedBody(request, 32768), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
