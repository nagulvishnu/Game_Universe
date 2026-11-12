import type { Metadata } from "next";
import { ExploreGames } from "@/components/explore/ExploreGames";

export const metadata: Metadata = {
  title: "Explore Games",
  description:
    "Search, filter and sort every registered game in the universe by name, genre, tag or category.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { category } = await searchParams;
  const initialCategory = Array.isArray(category) ? category[0] : category;

  return <ExploreGames initialCategory={initialCategory} />;
}
