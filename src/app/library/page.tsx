import type { Metadata } from "next";
import { LibraryView } from "@/components/games/LibraryView";
import { Footer } from "@/components/universe/HomeSections";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <>
      <LibraryView />
      <Footer />
    </>
  );
}
