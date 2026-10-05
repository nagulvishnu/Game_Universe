import { Intro } from "@/components/universe/Intro";
import { UniverseStage } from "@/components/universe/UniverseStage";
import { AboutSection, FeaturedSection, Footer } from "@/components/universe/HomeSections";
import { LibraryView } from "@/components/games/LibraryView";

export default function HomePage() {
  return (
    <>
      <Intro />
      <UniverseStage home />
      <FeaturedSection />
      <LibraryView embedded />
      <AboutSection />
      <Footer />
    </>
  );
}
