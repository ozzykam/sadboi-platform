import Link from "next/link";
export default function NotFound() {
  return (
    <main className="gallery-main gallery-empty">
      <h1>This artwork isn’t on display.</h1>
      <p>Browse the gallery for more work from the studio.</p>
      <Link href="/art">Return to the gallery →</Link>
    </main>
  );
}
