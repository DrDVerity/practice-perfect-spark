import { Section, Reveal, Eyebrow } from "./Section";
import step01 from "@/assets/archer/step-01.jpg";
import step02 from "@/assets/archer/step-02.jpg";
import step03 from "@/assets/archer/step-03.jpg";
import step04 from "@/assets/archer/step-04.jpg";
import step05 from "@/assets/archer/step-05.jpg";

const steps = [
  { n: "01", title: "The Intake", body: "A focused 20-minute questionnaire. Upload anything useful — patient personas, photos, past campaigns. Archer takes it from there.", image: step01, alt: "Abstract dental practice intake form interface" },
  { n: "02", title: "The Practice Report", body: "Archer scrapes your site, reads every Google review, sizes up local competitors, and delivers a SWOT-style intelligence brief it uses to generate the strategy and your complete campaign.", image: step02, alt: "Practice intelligence dashboard with SWOT and competitor charts" },
  { n: "03", title: "The Campaign", body: "Strategy, channel mix, budget, three ad variations, generated creative, branded landing pages, and a full content calendar.", image: step03, alt: "Campaign builder with ad creatives, calendar, and landing page" },
  { n: "04", title: "The Auto-Pilot", body: "Facebook, Instagram, Google, LinkedIn, email, your website — Archer schedules and ships everything, on brand, on time.", image: step04, alt: "Multi-channel auto-pilot scheduler node diagram" },
  { n: "05", title: "The Feedback Loop", body: "It tracks every click, lead, and booking — then quietly tunes the next campaign so each month outperforms the last.", image: step05, alt: "Performance analytics dashboard with ascending trend line" },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>How It Works</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Five steps. Then it just runs.</h2>
        </div>
      </Reveal>

      <div className="relative mt-16">
        <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-primary/40 via-accent/40 to-transparent md:left-1/2 md:block" />
        <div className="grid gap-8">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.05}>
              <div className={`grid items-center gap-6 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                    <span className="h-px w-12 bg-border" />
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold">{s.title}</h3>
                  <p className="mt-3 text-muted-foreground">{s.body}</p>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                  <img src={s.image} alt={s.alt} loading="lazy" width={1024} height={768} className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-background/30 via-transparent to-transparent" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
