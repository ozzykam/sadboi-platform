import type { Metadata } from "next";
import { PublicContact } from "@/components/public-contact";
export const metadata: Metadata = { title: "Contact", description: "Contact Sadboi Studio about commissions, shop help, wholesale, press, collaborations, or general questions." };
export default function Page() { return <PublicContact />; }
