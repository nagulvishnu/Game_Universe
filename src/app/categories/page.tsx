import type { Metadata } from "next";
import { CategoriesView } from "@/components/categories/CategoriesView";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse the universe by category — every registered game, grouped by how it is built.",
};

export default function CategoriesPage() {
  return <CategoriesView />;
}
