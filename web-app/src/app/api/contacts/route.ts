import { authResponse, protectedBody } from "@/server/auth-http";
import {
  contactsDirectory,
  contactsFailure,
  contactsStaff,
  saveContact,
} from "@/server/contacts";
export const runtime = "nodejs";
export async function GET() {
  try {
    await contactsStaff();
    return authResponse(await contactsDirectory());
  } catch (error) {
    return contactsFailure(error);
  }
}
async function write(request: Request, editing: boolean) {
  try {
    const staff = await contactsStaff(true),
      body = await protectedBody(request, 16384);
    return authResponse(
      await saveContact(body, staff, editing),
      editing ? 200 : 201,
    );
  } catch (error) {
    return contactsFailure(error);
  }
}
export async function POST(request: Request) {
  return write(request, false);
}
export async function PATCH(request: Request) {
  return write(request, true);
}
