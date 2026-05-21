import { Section, Reveal, Eyebrow } from "./Section";
import { Check, X } from "lucide-react";

const withArcher = [
  "Ready to use instantly",
  "Reliable, on-brand posting",
  "Built for independent practices",
  "Affordable — no hidden fees",
  "No learning curve",
  "Practice-trained AI in your voice",
  "Weekly 1-page report",
  "Real human support",
];

const without = [
  "Weeks of agency onboarding",
  "Generic templates, junior account manager",
  "Big monthly retainers",
  "Hidden fees and overages",
  "Steep learning curve",
  "Time-wasting tool-hopping",
  "Inconsistent posting",
  "Giving up after 60 days",
];

export function WithWithoutArcher() {
  return (
    <Section id="with-without" className="archer-lava-b">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>The difference</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">
            Marketing with Archer vs. <span className="text-gradient text-blue-700">without</span>
          </h2>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-primary/30 bg-card p-7 shadow-xl shadow-primary/10">
            <h3 className="text-lg font-semibold">Marketing with Archer</h3>
            <ul className="mt-5 space-y-3">
              {withArcher.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="h-full rounded-2xl border border-destructive/30 bg-card p-7">
            <h3 className="text-lg font-semibold">Marketing without Archer</h3>
            <ul className="mt-5 space-y-3">
              {without.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
