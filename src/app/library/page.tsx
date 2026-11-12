import { redirect } from "next/navigation";

/**
 * The library is now the Explore page.
 * This legacy path redirects so existing links keep working.
 */
export default function LibraryPage() {
  redirect("/explore");
}
