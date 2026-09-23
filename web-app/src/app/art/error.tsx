"use client";
export default function GalleryError({ reset }: { reset: () => void }) {
  return (
    <main className="gallery-main gallery-empty">
      <h1>The gallery is temporarily unavailable.</h1>
      <p>Please try again in a moment.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
