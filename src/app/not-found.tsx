import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[100svh] place-items-center px-6">
      <div className="text-center">
        <p className="gu-kicker">Error 404</p>
        <h1 className="gu-title gu-glow-text mt-3 text-4xl sm:text-6xl">Lost in space</h1>
        <p className="mt-4 text-lg text-dim">This region of the universe doesn&apos;t exist.</p>
        <Link href="/" className="gu-btn gu-btn--primary mt-8">
          Return to Game Universe
        </Link>
      </div>
    </div>
  );
}
