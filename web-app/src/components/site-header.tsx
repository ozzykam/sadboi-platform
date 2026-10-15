"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import logo from "../../public/images/logo-landscape.webp";

export function SiteHeader({
  instagramUrl,
  xUrl,
}: {
  instagramUrl: string;
  xUrl: string;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    function refresh() {
      try {
        const cart: unknown = JSON.parse(
          localStorage.getItem("sadboi-shop-cart") ?? "[]",
        );
        setCount(
          Array.isArray(cart)
            ? cart
                .slice(0, 1000)
                .reduce(
                  (total, line) =>
                    total +
                    (Number.isSafeInteger(line?.quantity) &&
                    line.quantity > 0 &&
                    line.quantity <= 1000
                      ? line.quantity
                      : 0),
                  0,
                )
            : 0,
        );
      } catch {
        setCount(0);
      }
    }
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener("sadboi-cart-updated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sadboi-cart-updated", refresh);
    };
  }, [pathname]);
  if (pathname === "/" || pathname.startsWith("/admin")) return null;
  return (
    <header className="shop-header site-header">
      <Link href="/" className="shop-logo" aria-label="Sadboi Studios home">
        <Image
          src={logo}
          alt="Sadboi Studios"
          className="shop-logo-image"
          sizes="91px"
          loading="eager"
        />
      </Link>
      <nav aria-label="Main navigation">
        <Link
          href="/art"
          aria-current={pathname.startsWith("/art") ? "page" : undefined}
        >
          Gallery
        </Link>
        <Link
          href="/shop"
          aria-current={pathname.startsWith("/shop") ? "page" : undefined}
        >
          Shop
        </Link>
        <Link href="/appearances" aria-current={pathname.startsWith("/appearances") ? "page" : undefined}>Appearances</Link>
        <Link href="/contact" aria-current={pathname.startsWith("/contact") ? "page" : undefined}>Contact</Link>
      </nav>
      <div className="shop-header-actions">
        {instagramUrl && (
          <a href={instagramUrl} className="site-social-link" target="_blank" rel="noopener noreferrer">
            <Image src="/images/ig-logo-blk.webp" alt="Instagram" width={20} height={20} />
          </a>
        )}
        {xUrl && (
          <a href={xUrl} className="site-social-link" target="_blank" rel="noopener noreferrer">
            <Image src="/images/x-logo-blk.webp" alt="X" width={20} height={20} />
          </a>
        )}
        <Link
          href="/sign-in"
          className="site-login"
          aria-label="Staff/Client login"
        >
          <span>Staff/Client Login</span>
          <LogIn size={18} aria-hidden="true" />
        </Link>
        {pathname === "/shop" || pathname.startsWith("/shop/") ? (
          <button
            type="button"
            className="shop-cart-button"
            onClick={() => window.dispatchEvent(new Event("sadboi-open-cart"))}
          >
            Cart <span>{count}</span>
          </button>
        ) : (
          <Link href="/shop?cart=open" className="shop-cart-button">
            Cart <span>{count}</span>
          </Link>
        )}
        {/* <Link href="/" className="shop-back"><House size={14} strokeWidth={1.8} aria-hidden="true" /></Link> */}
      </div>
    </header>
  );
}
