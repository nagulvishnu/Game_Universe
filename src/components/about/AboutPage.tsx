import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

const PILLARS = [
  {
    n: "01",
    t: "One destination",
    d: "Every game in this collection is reachable from a single hub. The holographic core on the home page holds them all — one card per world, orbiting in 3D.",
  },
  {
    n: "02",
    t: "Independent by design",
    d: "Each game is a self-contained project with its own code, controls and save data. Nothing is merged into the hub, so one world can never break another.",
  },
  {
    n: "03",
    t: "Always growing",
    d: "A game folder with a valid manifest becomes a world automatically. The registry is the single source of truth, and the universe re-forms around it.",
  },
];

const EXPERIENCE = [
  {
    t: "A machine you can talk to",
    d: "The core is a real 3D instrument — lit geometry, orbital rings, a scanning beam and a particle field. It reacts to the pointer and intensifies when the machine is choosing.",
  },
  {
    t: "Random pick",
    d: "When you cannot decide, the machine can. It spins up the orbit, hunts for a world, and brings one back to you as your next adventure.",
  },
  {
    t: "Find anything, fast",
    d: "Search across titles, genres and tags from the navigation bar, or filter the full catalogue by category on the explore page.",
  },
  {
    t: "Built for your machine",
    d: "The graphics quality, particle density and motion are tuned to the device you are on, and the whole experience respects reduced-motion preferences.",
  },
];

/** The About page — what the project is and what it aims to be. */
export function AboutPage() {
  return (
    <section className="gu-page" aria-labelledby="about-heading">
      <div className="mx-auto max-w-[1400px] px-[clamp(1rem,4vw,4rem)] pb-24 pt-32">
        <Reveal>
          <p className="gu-kicker">About the universe</p>
          <h1 id="about-heading" className="gu-title mt-3 max-w-4xl text-4xl sm:text-6xl">
            A single doorway into <span className="gu-gradient-text">different worlds</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#aab2c6]">
            Game Universe is a personal collection of independent browser games, gathered behind one
            holographic portal. Instead of a folder of links, every world gets a card that orbits a
            shared machine — so you can see the whole collection at once, step into any of them, and
            let the universe surprise you.
          </p>
        </Reveal>

        {/* Vision */}
        <Reveal className="mt-16" delay={80}>
          <div className="gu-about__band">
            <div className="gu-about__band-glow" aria-hidden />
            <p className="gu-kicker">The vision</p>
            <p className="gu-about__statement">
              A game collection should feel like a <em>place</em>, not a list. The interface aims to
              make discovery feel spatial — you circle the core, you watch the machine work, and the
              next world you play is one gesture away.
            </p>
          </div>
        </Reveal>

        {/* Pillars */}
        <div className="gu-about__pillars mt-14">
          {PILLARS.map((p, i) => (
            <Reveal key={p.n} delay={i * 90}>
              <article className="gu-panel gu-clip h-full p-7">
                <p className="gu-about__num">{p.n}</p>
                <h2 className="gu-title mt-4 text-xl">{p.t}</h2>
                <p className="mt-3 text-[#aab2c6]">{p.d}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Experience */}
        <Reveal className="mt-20" delay={60}>
          <p className="gu-kicker">The experience</p>
          <h2 className="gu-title mt-3 text-3xl sm:text-5xl">What it feels like to use</h2>
        </Reveal>
        <div className="gu-about__grid mt-10">
          {EXPERIENCE.map((e, i) => (
            <Reveal key={e.t} delay={i * 80}>
              <div className="gu-about__item">
                <h3 className="gu-title text-lg">{e.t}</h3>
                <p className="mt-2 text-[#aab2c6]">{e.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA */}
        <Reveal className="mt-20" delay={80}>
          <div className="gu-panel gu-clip flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="gu-title text-2xl">Ready to enter?</h2>
              <p className="mt-2 max-w-xl text-[#aab2c6]">
                Browse the full catalogue, or let the machine pick something for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/explore" className="gu-btn gu-btn--primary">
                Explore games
              </Link>
              <Link href="/" className="gu-btn">
                Random pick
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
