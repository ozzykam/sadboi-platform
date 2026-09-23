import { authResponse, protectedBody } from "@/server/auth-http";
import {
  financeCatalog,
  journalCatalog,
  paymentCatalog,
  refundCatalog,
  allocationCatalog,
  disputeCatalog,
  reconciliationCatalog,
  saveVendorBill,
  saveJournalEntry,
  savePayment,
  saveRefund,
  saveAllocation,
  saveDispute,
  saveReconciliation,
  savePeriodLock,
} from "@/server/finance";
import { inventoryStaff, inventoryFailure } from "@/server/inventory";
import {
  purchasingCatalog,
  quoteCatalog,
  proofCatalog,
  batchCatalog,
  reprintCatalog,
  purchaseReceipts,
  saveSupplier,
  savePurchaseOrder,
  saveQuote,
  saveProof,
  saveBatch,
  saveReprint,
  actOnPurchaseOrder,
  receivePurchaseOrder,
  recordPurchaseProduction,
  purchaseProductionHistory,
} from "@/server/purchasing";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await inventoryStaff();
    const query = new URL(request.url).searchParams;
    if (query.has("quotes")) return authResponse(await quoteCatalog());
    if (query.has("proofs"))
      return authResponse(await proofCatalog(query.get("order") ?? ""));
    if (query.has("batches"))
      return authResponse(await batchCatalog(query.get("order") ?? ""));
    if (query.has("reprints"))
      return authResponse(await reprintCatalog(query.get("order") ?? ""));
    if (query.has("bills")) return authResponse(await financeCatalog());
    if (query.has("journal")) return authResponse(await journalCatalog());
    if (query.has("payments")) return authResponse(await paymentCatalog());
    if (query.has("refunds")) return authResponse(await refundCatalog());
    if (query.has("allocations"))
      return authResponse(await allocationCatalog());
    if (query.has("disputes")) return authResponse(await disputeCatalog());
    if (query.has("reconciliations"))
      return authResponse(await reconciliationCatalog());
    if (query.has("history")) {
      if (query.get("history") !== "production" || !query.has("order"))
        return authResponse(
          { error: "Choose an order for production history." },
          400,
        );
      return authResponse(
        await purchaseProductionHistory(
          query.get("order")!,
          query.get("cursor"),
        ),
      );
    }
    return authResponse(
      query.has("order")
        ? await purchaseReceipts(query.get("order")!, query.get("cursor"))
        : await purchasingCatalog(),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
async function write(request: Request, editing: boolean) {
  try {
    const staff = await inventoryStaff(true),
      body = await protectedBody(request, 65536);
    const action = new URL(request.url).searchParams.get("action");
    if (action === "supplier")
      return authResponse(
        await saveSupplier(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "quote")
      return authResponse(
        await saveQuote(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "proof")
      return authResponse(
        await saveProof(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "batch")
      return authResponse(
        await saveBatch(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "reprint")
      return authResponse(
        await saveReprint(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "bill")
      return authResponse(
        await saveVendorBill(body, staff, editing),
        editing ? 200 : 201,
      );
    if (action === "journal")
      return authResponse(await saveJournalEntry(body, staff), 201);
    if (action === "payment")
      return authResponse(await savePayment(body, staff), 201);
    if (action === "refund")
      return authResponse(await saveRefund(body, staff), 201);
    if (action === "allocation")
      return authResponse(await saveAllocation(body, staff), 201);
    if (action === "dispute")
      return authResponse(await saveDispute(body, staff), 201);
    if (action === "reconciliation")
      return authResponse(await saveReconciliation(body, staff), 201);
    if (action === "period-lock")
      return authResponse(await savePeriodLock(body, staff), 201);
    if (action === "order")
      return authResponse(
        await savePurchaseOrder(body, staff, editing),
        editing ? 200 : 201,
      );
    if (!editing && action === "status")
      return authResponse(await actOnPurchaseOrder(body, staff), 201);
    if (!editing && action === "receipt")
      return authResponse(await receivePurchaseOrder(body, staff), 201);
    if (!editing && action === "production")
      return authResponse(await recordPurchaseProduction(body, staff), 201);
    return authResponse({ error: "Unknown purchasing action." }, 400);
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  return write(request, false);
}
export async function PATCH(request: Request) {
  return write(request, true);
}
