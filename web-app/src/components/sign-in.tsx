"use client";
import { useState, type FormEvent } from "react";
import type { FirebaseOptions } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { browserAuth, sessionRequest } from "@/lib/firebase-client";
import { Input } from "./ui";
export function SignIn({
  config,
  emulator,
}: {
  config: FirebaseOptions;
  emulator: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verify, setVerify] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setVerify(false);
    try {
      const auth = await browserAuth(config, emulator);
      if (create) {
        const account = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        try {
          await sendEmailVerification(account.user);
          setMessage(
            "Check your email for a verification link, then return here to sign in.",
          );
        } finally {
          await signOut(auth);
        }
        setCreate(false);
        setPassword("");
      } else {
        const account = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const result = await sessionRequest("POST", {
          idToken: await account.user.getIdToken(),
        });
        const data = await result.json();
        if (!result.ok) {
          if (data.code === "verify-email") setVerify(true);
          else await signOut(auth);
          setError(data.error ?? "Unable to sign in.");
          return;
        }
        await signOut(auth);
        setPassword("");
        // Full navigation discards cached staff pages when the session changes.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/admin");
      }
    } catch {
      setError(
        create
          ? "We could not create this account or send its verification email. Try signing in, or use password recovery if you already have an account."
          : "Unable to sign in. Check your email and password, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = await browserAuth(config, emulator);
      await sendPasswordResetEmail(auth, email.trim());
      setMessage(
        "If this address has an account, a password reset email will arrive shortly.",
      );
    } catch {
      setMessage(
        "If this address has an account, a password reset email will arrive shortly. If it does not arrive, wait before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyEmail() {
    setBusy(true);
    setError("");
    try {
      const auth = await browserAuth(config, emulator);
      if (!auth.currentUser) throw new Error();
      await sendEmailVerification(auth.currentUser);
      await signOut(auth);
      setVerify(false);
      setPassword("");
      setMessage(
        "Verification email sent. Follow the link, then sign in again.",
      );
    } catch {
      setError("Unable to send verification. Sign in again and retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      {emulator && (
        <p className="notice">
          Local authentication emulator. Use test accounts only.
        </p>
      )}
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete={create ? "new-password" : "current-password"}
        required
        minLength={create ? 12 : undefined}
        maxLength={128}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
        helperText={
          create
            ? "Use at least 12 characters. Staff access requires an approved, verified email address."
            : undefined
        }
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <button
        type="submit"
        className="button primary"
        disabled={busy}
        aria-busy={busy}
      >
        {busy
          ? "Please wait…"
          : create
            ? "Create account & send verification"
            : "Sign in to the studio"}
      </button>
      {verify && (
        <button
          type="button"
          className="button secondary"
          onClick={verifyEmail}
          disabled={busy}
        >
          Send verification email
        </button>
      )}
      <div className="auth-options">
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={() => {
            setCreate(!create);
            setError("");
            setMessage("");
          }}
        >
          {create
            ? "Already have an account? Sign in"
            : "First visit? Create your staff account"}
        </button>
        {!create && (
          <button
            type="button"
            className="button ghost"
            onClick={recover}
            disabled={busy}
          >
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
}
