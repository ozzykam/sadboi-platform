export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="gallery-shell">
      {children}
      <footer className="gallery-footer">
        <span>Sadboi Studios / Joel Hedstrom</span>
        <span>Original work. All rights reserved.</span>
      </footer>
    </div>
  );
}
