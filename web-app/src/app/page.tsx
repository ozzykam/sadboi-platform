import Link from "next/link";
import Image from "next/image";
import { BookImage, LogIn, ShoppingBag, CalendarDays } from "lucide-react";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <main className="entrance">
      <div className="entrance-top">
        <div className="entrance-nav" aria-label="Main navigation">
        </div>
      </div>
      <div className="entrance-hero">
        <div className="entrance-content">
          <p className="eyebrow">WELCOME TO</p>
          <h1>Sadboi Studios</h1>
          <div className="entrance-rule" />
          <p>
            Original work and editions
            <br />
            by Joel Hedstrom
          </p>
          <div className="entrance-actions">
            <Link href="/art" className="button primary">
              View Gallery <BookImage size={18} aria-hidden="true" />
            </Link>
            <Link href="/shop" className="button secondary">
              Shop Merch <ShoppingBag size={18} aria-hidden="true" />
            </Link>
            <Link href="/appearances" className="button secondary">
              Public Events <CalendarDays size={18} aria-hidden="true" />
            </Link>
          </div>
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
        <span>
          <Link href="/sign-in" className="entrance-login" aria-label="Staff/client login">
            <span><span className="entrance-login-prefix">STAFF/CLIENT </span>LOGIN</span>
            <LogIn size={16} aria-hidden="true" />
          </Link>
        </span>
      </footer>
    </main>
  );
}
