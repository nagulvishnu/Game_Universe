import { redirect } from "next/navigation";

/**
 * The universe now lives on the home page as the holographic stage.
 * This legacy path redirects so existing links keep working.
 */
export default function UniversePage() {
  redirect("/");
}
