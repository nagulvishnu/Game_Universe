import type { Metadata } from "next";
import { UniverseStage } from "@/components/universe/UniverseStage";

export const metadata: Metadata = { title: "Universe" };

export default function UniversePage() {
  return <UniverseStage />;
}
