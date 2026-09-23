import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getMode } from "@/server/mode";
export const dynamic = "force-dynamic";
export default function Home() {
  const preview = getMode() === "preview";
  return (
    <main className="entrance">
      <div className="entrance-top">
        <span className="mobile-wordmark"></span>
        <span>
          <Link href="/sign-in">
            STAFF/CLIENT LOGIN
          </Link>
        </span>
      </div>
      <div className="entrance-hero">
        <div className="entrance-content">
          <p className="eyebrow">WELCOME TO</p>
          <h1>
            
            Sadboi Studios
          </h1>
          <div className="entrance-rule" />
          <p>
            Original work and editions
            <br />
            by Joel Hedstrom
          </p>
          {preview ? (
            <Link href="/shop" className="button primary">
              Explore<ArrowUpRight size={18} />
            </Link>
          ) : (
            <Link href="/shop" className="button primary">
              Explore<ArrowUpRight size={18} />
            </Link>
          )}
        </div>
        <Image
          src="/images/logo-portrait.png"
          alt="Sadboi"
          width={399}
          height={698}
          sizes="(max-width: 760px) 140px, (max-width: 1400px) 20vw, 280px"
          loading="eager"
          className="entrance-logo"
        />
      </div>
      <footer>
        <span>© 2026 Sadboi Studio. All rights reserved.</span>
      </footer>
    </main>
  );
}
