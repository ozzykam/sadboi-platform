import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getMode } from "@/server/mode";
export const dynamic = "force-dynamic";
export default function Home() {
  const preview = getMode() === "preview";
  return (
    <main className="entrance">
      <div className="entrance-top">
        <span className="mobile-wordmark">sadboi</span>
        <span>JOEL HEDSTROM / STUDIO</span>
      </div>
      <div className="entrance-content">
        <p className="eyebrow">THE NEXT CHAPTER</p>
        <h1>
          A home for
          <br />
          the work.
        </h1>
        <div className="entrance-rule" />
        <p>
          Art, editions, and everything behind them.
          <br />
          The Sadboi studio platform is taking shape.
        </p>
        {preview ? (
          <Link href="/admin" className="button primary">
            Enter the studio preview <ArrowUpRight size={18} />
          </Link>
        ) : (
          <Link href="/sign-in" className="button primary">
            Staff sign-in <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
      <footer>
        <span>SADBOI / STUDIO</span>
        <span>Foundation build. The public art website comes next.</span>
      </footer>
    </main>
  );
}
