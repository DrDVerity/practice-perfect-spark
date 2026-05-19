import { Section, Reveal, Eyebrow } from "./Section";
import { Brain, Wand2, CalendarClock, Inbox } from "lucide-react";

const features = [
  { icon: Brain, title: "Learns Your Practice", body: "Scrapes your website, Google reviews, brand voice, services, and local competitors — then writes a practice intelligence brief." },
  { icon: Wand2, title: "Builds Full Campaigns", body: "Strategy, channel mix, budget, three variations of ad copy, generated images and video, and branded landing pages." },
  { icon: CalendarClock, title: "Posts on Auto-Pilot", body: "Facebook, Instagram, Google Business Profile (GMB) posts, LinkedIn, TikTok, email, and your own site. All on schedule, all on brand, every week." },
  { icon: Inbox, title: "Captures Leads", body: "Every click lands on a conversion-optimized page. New patient inquiries flow straight into your Archer dashboard." },
];

export function Solution() {
  return (
    <Section id="features" className="bg-emerald-400/25">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>What Archer Does</Eyebrow>
          <h2 className="mt-4">
            <span className="block text-3xl font-bold text-white md:text-4xl">One platform. Four jobs.</span>
            <span className="mt-2 block text-4xl font-bold text-black md:text-5xl dark:text-white">Rocketing ROI.</span>
          </h2>
        </div>
      </Reveal>

      <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="relative mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
