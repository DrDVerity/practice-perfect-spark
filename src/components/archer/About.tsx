import { Section, Reveal, Eyebrow } from "./Section";
import aboutImg from "@/assets/archer/about.jpg";

const stats = [
  { value: "1M+", label: "Dental reviews analyzed" },
  { value: "40+", label: "Dental ad archetypes trained in" },
  { value: "100%", label: "Dentist-first, not retrofit" },
];

export function About() {
  return (
    <Section id="about" className="bg-secondary">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div>
            <Eyebrow>About Digital Dental Fusion</Eyebrow>
            <h2 className="mt-4 text-4xl font-bold md:text-5xl">From the AI experts at <span className="text-gradient">Digital Dental Fusion.</span></h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>We sit at the intersection of AI engineering and dental practice marketing — years spent inside operatories and inside the model stack that now powers Archer.</p>
              <p>We've analyzed more than a million dental reviews, mapped forty-plus dental ad archetypes, and built guardrails so Archer never sounds like generic SaaS or templated agency copy.</p>
              <p>We refuse to ship anything that wouldn't pass a chairside sniff test. Archer is what we wished existed when we ran marketing for practices ourselves.</p>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                  <div className="text-2xl font-bold text-gradient">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-border/60 shadow-2xl shadow-primary/10">
              <img src={aboutImg} alt="Digital Dental Fusion" width={1280} height={960} loading="lazy" className="h-auto w-full" />
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
