import type { Metadata } from "next";
import { publicAppearances } from "@/server/events";
import { Appearances } from "@/components/appearances";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Appearances",
  description:
    "Meet Sadboi at upcoming markets, conventions, festivals and other confirmed appearances.",
};
export default async function Page() {
  const now = new Date().toISOString();
  return (
    <Appearances
      appearances={await publicAppearances(now)}
      initialMonth={now.slice(0, 7)}
    />
  );
}
