import { Section, Reveal, Eyebrow } from "./Section";
import { FileSearch, Target, Type, ImageIcon, LayoutTemplate, CalendarRange, Send, LineChart } from "lucide-react";

const tiles = [
  { icon: FileSearch, title: "Practice intelligence report", body: "SWOT-style brief tailored to your patients, reviews, and local market." },
  { icon: Target, title: "Channel & budget strategy", body: "Where to spend, how much, and why — recalculated every campaign." },
  { icon: Type, title: "3 variations of ad copy", body: "Three angles per audience, A/B-ready, written in your voice." },
  { icon: ImageIcon, title: "Generated images & video", body: "On-brand creative produced for you — no stock-photo handshakes." },
  { icon: LayoutTemplate, title: "Branded landing pages", body: "Conversion-optimized pages that match your brand and convert clicks." },
  { icon: CalendarRange, title: "Content calendar", body: "A full month of posts, planned, scheduled, and ready to ship." },
  { icon: Send, title: "Auto-scheduled posting", body: "Facebook, Instagram, Google, LinkedIn, email, and your site." },
  { icon: LineChart, title: "Lead dashboard", body: "Every click, lead, and booking — surfaced in real time." },
];

export function Deliverables() {
  return (
    <Section id="deliverables" className="bg-secondary">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>What's In Every Campaign</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Everything an agency ships. Delivered in days, not months.</h2>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <Reveal key={t.title} delay={i * 0.04}>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <t.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{t.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
