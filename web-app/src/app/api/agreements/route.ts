import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure } from "@/server/inventory";
import { contactsStaff } from "@/server/contacts";
import { agreementDetail, saveAgreement } from "@/server/agreements";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const staff = await contactsStaff(),
      proposalId = new URL(request.url).searchParams.get("proposalId");
    return authResponse(await agreementDetail({ proposalId }, staff));
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await contactsStaff();
    return authResponse(
      await saveAgreement(await protectedBody(request, 131072), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
