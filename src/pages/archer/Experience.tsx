import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/archer/Header";
import { Footer } from "@/components/archer/Footer";
import { SubPageHero } from "@/components/archer/SubPageHero";
import { Section, Reveal, Eyebrow } from "@/components/archer/Section";
import { WeekWithArcher } from "@/components/archer/WeekWithArcher";
import { PersonaMarquee } from "@/components/archer/PersonaMarquee";
import { WithWithoutArcher } from "@/components/archer/WithWithoutArcher";
import { ProductShotStrip } from "@/components/archer/ProductShotStrip";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";

const voices = [
  {
    name: "Dr. Imani O., DDS",
    practice: "Solo family practice · Austin, TX",
    quote:
      "We fired our agency. Archer does the same work, faster — and it actually sounds like our practice.",
  },
  {
    name: "Dr. Marcus T., DMD",
    practice: "Partner-owned group · Denver, CO",
    quote:
      "I give it 20 minutes on Monday morning and forget about marketing for the rest of the week. New patients keep showing up.",
  },
  {
    name: "Dr. Priya S., DDS",
    practice: "Dentist-owned, 3 locations · Phoenix, AZ",
    quote:
      "Finally a tool built for practices like ours — not for chains and not for restaurants. The voice matches each location.",
  },
];

export default function ExperiencePage() {
  useEffect(() => {
    document.title = "Client Experience — A Week With Archer";
  }, []);

  return (
    <div className="archer min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <SubPageHero
          eyebrow="Client Experience"
          title={
            <>
              What your week looks like <span className="text-gradient">with Archer.</span>
            </>
          }
          intro="Twenty minutes on Monday morning. A full week of campaigns, posts, replies, leads, and a one-page report — handled. Built for independent dental practices."
        />

        <PersonaMarquee />
        <WeekWithArcher />
        <ProductShotStrip />
        <WithWithoutArcher />

        <Section id="voices" className="archer-lava-b">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>From the operatory</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">
                Independent dentists, <span className="text-gradient">in their own words.</span>
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {voices.map((v, i) => (
              <Reveal key={v.name} delay={i * 0.06}>
                <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card p-7">
                  <div className="flex gap-0.5 text-accent">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-base italic leading-relaxed text-foreground">
                    "{v.quote}"
                  </blockquote>
                  <div className="mt-5 border-t border-border/60 pt-4">
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.practice}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <section className="archer-lava-a relative overflow-hidden px-6 py-28 md:py-36">

          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-5xl font-bold tracking-tight md:text-6xl">
                See Archer build <span className="text-gradient">your week.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                Free preview. No credit card. No onboarding marathon. Just a complete campaign built for your
                practice.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" className="h-12 px-6 text-base shadow-xl shadow-primary/25" asChild>
                  <Link to="/get-started">
                    Build my campaign — free <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                  <Link to="/contact">Talk to a human</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
