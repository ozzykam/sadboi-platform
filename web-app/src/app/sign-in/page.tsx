import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { SignIn } from "@/components/sign-in";
import { authConfig } from "@/server/firebase";
import { getMode } from "@/server/mode";
import { cookieName, staffForCookie } from "@/server/staff";
export const dynamic = "force-dynamic";
export default async function SignInPage() {
  if (getMode() !== "staff")
    return (
      <main className="locked-screen">
        <p className="eyebrow">SADBOI STUDIO</p>
        <h1>Staff sign-in is not enabled.</h1>
        <Link href="/">Back to entrance</Link>
      </main>
    );
  const config = authConfig();
  // Use one cookie/CSRF origin even when a developer opens the loopback alias.
  const canonical = new URL(config.origin);
  const host = (await headers()).get("host")?.toLowerCase();
  const loopbackHosts = ["localhost", "127.0.0.1"].map(
    (name) => name + (canonical.port ? ":" + canonical.port : ""),
  );
  if (
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(canonical.hostname) &&
    host &&
    loopbackHosts.includes(host) &&
    host !== canonical.host
  )
    redirect(config.origin + "/sign-in");
  if (await staffForCookie((await cookies()).get(cookieName("session"))?.value))
    redirect("/admin");
  return (
    <main className="auth-page">
      <Link href="/" className="wordmark">
        sadboi<small>STUDIO MANAGER</small>
      </Link>
      <section className="auth-card">
        <p className="eyebrow">BEHIND THE WORK</p>
        <SignIn config={config.firebase} emulator={config.emulator} />
      </section>
      <p className="auth-footnote">
        For approved studio staff. Creating an account does not grant staff
        access.
      </p>
    </main>
  );
}
