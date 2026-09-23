import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Sadboi — Studio", template: "%s · Sadboi Studio" },
  description: "An evolving home for the artwork and business of Sadboi.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
