import { Reveal, Section, Eyebrow } from "./Section";
import { PenLine, ImageIcon, Calendar, Lightbulb, Inbox, BarChart3 } from "lucide-react";

const items = [
  { icon: PenLine, title: "AI Post Writer", desc: "Captions + hashtags in your practice's voice." },
  { icon: ImageIcon, title: "AI Image Maker", desc: "On-brand visuals generated for every post." },
  { icon: Calendar, title: "Content Calendar", desc: "See your whole month at a glance." },
  { icon: Lightbulb, title: "Smart Post Ideas", desc: "Daily prompts tailored to your practice." },
  { icon: Inbox, title: "Social Inbox", desc: "Comments + DMs in one place.", soon: true },
  { icon: BarChart3, title: "Performance", desc: "See what's working, drop what's not.", soon: true },
];

export function EverythingYouNeed() {
  return (
    <Section id="everything-you-need" className="archer-section-dark archer-section-divider">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>What's inside</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">
            Everything you need, <span className="text-gradient">nothing you don't.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            The same tools the big agencies sell you — built into Archer, tuned for independent dental practices,
            and ready the day you sign up.
          </p>
        </div>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.05}>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <it.icon className="size-5" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <h3 className="text-lg font-semibold">{it.title}</h3>
                {it.soon && (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
