import { Section, Reveal, Eyebrow } from "./Section";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Frown, Wallet } from "lucide-react";

export function PainReveal() {
  return (
    <Section id="pain-reveal" className="archer-lava-b">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Why most practices struggle</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">
            4 out of 5 independent practices say marketing is their{" "}
            <span className="text-gradient">#1 frustration</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Why?</p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-destructive/30 bg-card p-7">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Wallet className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Overpriced agencies</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              $3K–$8K a month, a 60-day onboarding, and a junior account manager who has never set foot in a dental
              operatory. You pay premium and still don't sound like your practice.
            </p>
            <p className="mt-4 text-sm italic text-muted-foreground">Leaving you with an empty wallet.</p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="h-full rounded-2xl border border-destructive/30 bg-card p-7">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Frown className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Time-eating DIY</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Ten-plus hours a week of guessing what to post, fighting tools designed for big brands, and a
              steep learning curve that turns marketing into a second job you never trained for.
            </p>
            <p className="mt-4 text-sm italic text-muted-foreground">Making you put marketing off — again.</p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.15}>
        <div className="mt-14 rounded-2xl border border-primary/30 bg-card p-10 text-center shadow-xl shadow-primary/10">
          <h3 className="text-3xl font-bold md:text-4xl">
            Thankfully, <span className="text-gradient">Archer is designed for you</span>
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Built for independent dental practices — and it fits easily into any busy operation. You don't need a
            marketing degree. You need your evenings back.
          </p>
          <div className="mt-7 flex justify-center">
            <Button size="lg" asChild className="shadow-lg shadow-primary/20 text-slate-50">
              <Link to="/get-started">
                See Archer build your campaign <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
