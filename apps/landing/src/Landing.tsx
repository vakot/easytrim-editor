import { LandingAchievements } from "./components/LandingAchievements";
import { LandingDownloads } from "./components/LandingDownloads";
import { LandingFeatures } from "./components/LandingFeatures";
import { LandingFooter } from "./components/LandingFooter";
import { LandingHeader } from "./components/LandingHeader";
import { LandingHero } from "./components/LandingHero";
import { LandingShowcase } from "./components/LandingShowcase";

function Landing() {
  return (
    <>
      <a
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main">
        <LandingHero />
        <LandingFeatures />
        <LandingShowcase />
        <LandingAchievements />
        <LandingDownloads />
      </main>
      <LandingFooter />
    </>
  );
}

export { Landing };
