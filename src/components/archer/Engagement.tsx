import { Section, Reveal, Eyebrow } from "./Section";
import { Inbox, MessagesSquare, BellRing, CalendarClock, ShieldCheck } from "lucide-react";

const features = [
  { icon: Inbox, title: "Omni-Channel Engagement", body: "Instagram DMs, Facebook comments, Google Q&A, WhatsApp, Telegram, SMS, and website chat, unified into one inbox the AI can answer for you." },
  { icon: MessagesSquare, title: "AI-Drafted Replies", body: "Archer reads the message, checks your brand voice, and drafts a HIPAA-safe response. You tap approve, or let it auto-send for FAQs." },
  { icon: CalendarClock, title: "Live Chair-Time Optimization", body: "Archer syncs with your PMS to spot empty chairs in real time, then auto-sends 'Flash Sale' offers over SMS to fill the slot the same day." },
  { icon: BellRing, title: "Real-Time Lead Alerts", body: "When someone asks about Invisalign at 9 PM, your front desk knows by 9:01. Push, email, and SMS alerts for every booking signal." },
];

export function Engagement() {
  return (
    <Section id="engagement" className="bg-secondary">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Patient Engagement</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Every channel in one inbox. <span className="text-gradient text-blue-700">Nothing falls through.</span></h2>
          <p className="mt-4 text-lg text-muted-foreground">New patients reach out where they live, Instagram DMs, WhatsApp, Telegram, SMS, Facebook, Google. Archer pulls them into one inbox and the AI agent engages autonomously, 24/7.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="size-3.5 text-primary" /> HIPAA Compliant · No PHI in campaigns
          </div>
        </div>
      </Reveal>
      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.05}>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="size-5" /></div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
