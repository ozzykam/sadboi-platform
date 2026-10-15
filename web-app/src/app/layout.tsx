import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { publicSeo } from "@/server/seo";
export const metadata: Metadata = {
  title: { default: "Sadboi — Studio", template: "%s · Sadboi Studio" },
  description: "An evolving home for the artwork and business of Sadboi.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { input } = await publicSeo();
  return (
    <html lang="en">
      <body>
        <SiteHeader instagramUrl={input.instagramUrl} xUrl={input.xUrl} />
        {children}
      </body>
    </html>
  );
}
