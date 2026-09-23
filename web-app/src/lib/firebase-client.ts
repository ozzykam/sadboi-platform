"use client";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";
let connection: ReturnType<typeof getAuth> | undefined;
export async function browserAuth(config: FirebaseOptions, emulator: boolean) {
  if (!connection) {
    const name = emulator ? "sadboi-emulator" : "sadboi-live";
    const app =
      getApps().find((app) => app.name === name) ?? initializeApp(config, name);
    connection = getAuth(app);
    if (emulator) connectAuthEmulator(connection, "http://127.0.0.1:9099");
  }
  await setPersistence(connection, inMemoryPersistence);
  return connection;
}
export async function sessionRequest(method: "POST" | "DELETE", body: object) {
  const csrf = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!csrf.ok) throw new Error("Staff sign-in is temporarily unavailable.");
  const { token } = await csrf.json();
  return fetch("/api/auth/session", {
    method,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
    body: JSON.stringify(body),
  });
}
