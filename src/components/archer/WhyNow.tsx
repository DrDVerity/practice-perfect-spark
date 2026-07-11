import { Section, Reveal, Eyebrow } from "./Section";
import { Clock, TrendingUp, Trophy } from "lucide-react";

const points = [
  { icon: Clock, title: "Patients decide online first.", body: "Instagram, Google, reviews, your next new patient has already formed an opinion before they ever pick up the phone." },
  { icon: TrendingUp, title: "Early movers compound.", body: "Better data fuels better campaigns, which fuel better patient flow, which fuels better data. The lead widens fast." },
  { icon: Trophy, title: "In 24 months, this is table stakes.", body: "Today it's an unfair advantage. Tomorrow it's the minimum bar. The window to get out front is open now." },
];

export function WhyNow() {
  return (
    <Section id="why-now" className="bg-[#001f5b]/70">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#d4af37]" />
            Why Now
          </span>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl text-white">The AI marketing window is open. It won't be for long.</h2>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {points.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.07}>
            <div className="h-full rounded-2xl border border-white/20 bg-[#001f5b]/70 p-7">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#d4af37] text-black">
                <p.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
