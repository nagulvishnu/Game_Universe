import type { Metadata } from "next";
import { SettingsPanel } from "@/components/ui/SettingsPanel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <section className="mx-auto max-w-3xl px-[clamp(1rem,4vw,2rem)] pb-24 pt-28">
      <p className="gu-kicker">Control center</p>
      <h1 className="gu-title mt-3 text-4xl sm:text-5xl">Settings</h1>
      <div className="gu-panel gu-clip mt-8 px-7 py-3">
        <SettingsPanel />
      </div>
    </section>
  );
}
