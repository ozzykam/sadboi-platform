"use client";
export async function artworkRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") {
    const proof = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!proof.ok)
      throw new Error(
        "Your session may have ended. Sign in again before saving.",
      );
    headers.set("X-CSRF-Token", (await proof.json()).token);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error ?? "The artwork could not be saved. Please retry.",
    );
  return data;
}
