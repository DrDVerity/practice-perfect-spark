import { Section, Reveal, Eyebrow } from "./Section";
import { Star, MessageSquareReply, Megaphone, ShieldCheck, Gauge } from "lucide-react";

const features = [
  { icon: Star, title: "Automated Review Requests", body: "Archer texts and emails every patient post-visit — synced with Dentrix, Open Dental, and Eaglesoft. More 5-star Google reviews, on autopilot." },
  { icon: MessageSquareReply, title: "AI Review Replies", body: "Every Google and Facebook review gets a sentiment-aware, HIPAA-safe response drafted for you. Approve from your phone in seconds." },
  { icon: Gauge, title: "Sentiment Analysis", body: "Archer reads every review and categorizes it Positive, Neutral, or Urgent — so the front desk can triage what actually needs a human, fast." },
  { icon: Megaphone, title: "Review Marketing", body: "Your best reviews auto-syndicate to Instagram, your landing pages, and your site — turning happy patients into your most effective ad spend." },
  { icon: ShieldCheck, title: "Reputation Dashboard", body: "One score, every location. Track stars, sentiment, and response time across Google, Facebook, and Healthgrades in real time." },
];

export function Reviews() {
  return (
    <Section id="reviews" className="bg-[#001f5b] text-white">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Reputation Engine</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Your reviews are your #1 marketing channel. <span className="text-gradient">We run it for you.</span></h2>
          <p className="mt-4 text-lg text-muted-foreground">93% of new patients read your reviews before they book. Archer turns every visit into a 5-star review — and turns every 5-star review into new bookings.</p>
        </div>
      </Reveal>
      <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="absolute -right-10 -top-10 size-32 rounded-full bg-accent/10 blur-3xl" />
              <div className="relative flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><f.icon className="size-5" /></div>
              <h3 className="relative mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
