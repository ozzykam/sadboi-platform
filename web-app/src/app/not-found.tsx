import Link from "next/link";
export default function NotFound() {
  return (
    <main className="locked-screen">
      <p className="eyebrow">404 / NOT IN THE ARCHIVE</p>
      <h1>This page is not here.</h1>
      <Link href="/" className="button secondary">
        Back to the entrance
      </Link>
    </main>
  );
}
