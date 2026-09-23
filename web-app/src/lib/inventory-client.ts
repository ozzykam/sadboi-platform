"use client";
export class InventoryRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function inventoryRequest(
  path: string,
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") {
    const proof = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!proof.ok)
      throw new InventoryRequestError(
        "Your session may have ended. Sign in again before saving.",
        proof.status,
      );
    headers.set("X-CSRF-Token", (await proof.json()).token);
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new InventoryRequestError(
      data.error ?? "Inventory could not be loaded. Please retry.",
      response.status,
      data.code,
    );
  return data;
}
