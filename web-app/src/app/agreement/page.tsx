import type { Metadata } from "next";
import { AgreementSigning } from "@/components/agreement-signing";
export const metadata: Metadata = {
  title: "Review agreement",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <AgreementSigning />;
}
