import { Section, Reveal, Eyebrow } from "./Section";
import { LayoutDashboard, Sparkles, Megaphone, Globe } from "lucide-react";

const shots = [
  { icon: LayoutDashboard, title: "Your dashboard", desc: "Every campaign, channel, and lead in one calm view." },
  { icon: Megaphone, title: "Campaign card", desc: "Strategy, creative, and budget — approved in a click." },
  { icon: Sparkles, title: "AI post variations", desc: "Three on-brand options for every post, every time." },
  { icon: Globe, title: "Branded landing page", desc: "Auto-generated, conversion-optimized, your colors." },
];

export function ProductShotStrip() {
  return (
    <Section id="product-shots" className="archer-section-navy archer-section-divider">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>What you actually see</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">
            Real Archer screens. <span className="text-gradient text-blue-700">Real work, done.</span>
          </h2>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {shots.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <div className="group h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              {/* Laptop-style frame placeholder */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-accent/10">
                <div className="absolute inset-x-0 top-0 flex h-5 items-center gap-1 border-b border-border/60 bg-background/60 px-2">
                  <span className="size-1.5 rounded-full bg-destructive/70" />
                  <span className="size-1.5 rounded-full bg-accent/70" />
                  <span className="size-1.5 rounded-full bg-primary/70" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <s.icon className="size-14 text-primary/60" />
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
