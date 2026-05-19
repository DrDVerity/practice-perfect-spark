import { Section, Reveal, Eyebrow } from "./Section";
import { Building2, UserRound, Wrench } from "lucide-react";

const items = [
  { icon: Building2, title: "Hire an agency", cost: "$3K–$8K / month", detail: "Sixty-day onboarding, generic dental templates, and a junior account manager who doesn't know a crown from a veneer." },
  { icon: UserRound, title: "Hire in-house", cost: "$65K+ salary", detail: "Plus tools, plus benefits, plus the eighteen-month average tenure before they leave and you start over." },
  { icon: Wrench, title: "Do it yourself", cost: "10+ hours / week", detail: "Inconsistent posting, no real strategy, and a slow drift toward whatever Instagram trend isn't dental." },
];

export function Problem() {
  return (
    <Section id="problem">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>The Problem</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Your Practice Marketing is Broken</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every dentist gets handed the same three options. None of them actually work well.
          </p>
        </div>
      </Reveal>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.08}>
            <div className="group h-full rounded-2xl border border-border/60 bg-card/40 p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <it.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{it.title}</h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{it.cost}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{it.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <p className="mt-14 text-center text-xl font-medium text-foreground">
          There's a fourth option. <span className="text-gradient">It's Archer.</span>
        </p>
      </Reveal>
    </Section>
  );
}
