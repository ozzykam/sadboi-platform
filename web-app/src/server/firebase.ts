import "server-only";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import registration from "../../../firebase.web.config.json";
import { firebaseCredential } from "./firebase-credentials";

export function authConfig() {
  const environment = process.env.SADBOI_AUTH_ENV;
  if (environment !== "emulator" && environment !== "live")
    throw new Error("Set SADBOI_AUTH_ENV to emulator or live.");
  const origin = process.env.SADBOI_APP_ORIGIN;
  if (!origin || new URL(origin).origin !== origin)
    throw new Error("Set SADBOI_APP_ORIGIN to the exact application origin.");
  const loopback = ["127.0.0.1", "localhost"].includes(
    new URL(origin).hostname,
  );
  if (
    new URL(origin).protocol !== "https:" &&
    !(process.env.NODE_ENV === "development" && loopback)
  )
    throw new Error(
      "Staff access requires HTTPS except on the local development server.",
    );
  const emulator = environment === "emulator";
  if (emulator) {
    if (process.env.NODE_ENV === "production" || !loopback)
      throw new Error("Emulators are allowed only in local development.");
    if (
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
    )
      throw new Error("Set the loopback Auth and Firestore emulator hosts.");
  } else if (
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    process.env.STORAGE_EMULATOR_HOST
  ) {
    throw new Error(
      "Remove emulator variables before connecting to live Firebase.",
    );
  }
  return {
    emulator,
    origin,
    secure: new URL(origin).protocol === "https:",
    firebase: emulator
      ? {
          ...registration,
          projectId: "demo-sadboi-platform",
          apiKey: "demo-key",
          authDomain: "demo-sadboi-platform.firebaseapp.com",
          storageBucket: "demo-sadboi-platform.firebasestorage.app",
        }
      : registration,
  };
}
export function adminServices() {
  const config = authConfig();
  const name = config.emulator ? "sadboi-emulator" : "sadboi-live";
  const app =
    getApps().find((app) => app.name === name) ??
    initializeApp(
      {
        projectId: config.firebase.projectId,
        ...(config.emulator
          ? {}
          : {
              credential: firebaseCredential({
                emulator: config.emulator,
                projectId: config.firebase.projectId,
              }),
            }),
      },
      name,
    );
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function artworkBucket() {
  const config = authConfig();
  if (
    config.emulator &&
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199"
  )
    throw new Error(
      "Set the loopback Storage emulator host before accessing files.",
    );
  const { auth } = adminServices();
  return getStorage(auth.app).bucket(config.firebase.storageBucket);
}
