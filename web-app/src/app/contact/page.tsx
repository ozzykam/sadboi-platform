import { publicPageMetadata } from "@/server/seo";
import { PublicContact } from "@/components/public-contact";
export const generateMetadata = () =>
  publicPageMetadata("/contact", {
    title: "Contact",
    description:
      "Contact Sadboi Studio about commissions, shop help, wholesale, press, collaborations, or general questions.",
  });
export default function Page() {
  return <PublicContact />;
}
