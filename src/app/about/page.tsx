import type { Metadata } from "next";
import { AboutPage } from "@/components/about/AboutPage";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Game Universe is: one portal for discovering and playing a growing collection of independent browser games.",
};

export default function About() {
  return <AboutPage />;
}
