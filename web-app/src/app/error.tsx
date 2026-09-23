"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="locked-screen">
      <h1>The workspace could not open.</h1>
      <p>Your local drafts have not been cleared.</p>
      <button className="button secondary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
