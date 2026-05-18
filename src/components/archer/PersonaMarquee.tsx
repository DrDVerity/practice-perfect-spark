import { Section, Reveal, Eyebrow } from "./Section";

const personas = [
  "Family dentistry",
  "Pediatric",
  "Orthodontics",
  "Cosmetic",
  "Implants",
  "Endodontics",
  "Periodontics",
  "Partner-owned group",
  "Dentist-owned multi-location",
  "Mobile dental",
  "Concierge",
  "Sleep & TMJ",
];

export function PersonaMarquee() {
  const loop = [...personas, ...personas];
  return (
    <Section id="personas" className="archer-lava-a border-y border-white/10 !py-16">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Built for independent practices</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">
            Independent dentists across every specialty <span className="text-gradient">trust Archer</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Solo, partner-owned, and dentist-owned multi-location practices (60%+ dentist ownership).
          </p>
        </div>
      </Reveal>

      <div className="relative mt-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-3">
          {loop.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-card px-5 py-2.5 text-sm font-medium text-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </Section>
  );
}
