import { Section, Reveal, Eyebrow } from "./Section";
import { CalendarCheck, Send, MessageCircle, Inbox, FileBarChart } from "lucide-react";

const days = [
  {
    day: "Monday",
    minutes: "5 min",
    icon: CalendarCheck,
    title: "Open the dashboard. Approve this week's campaign.",
    desc:
      "Archer hands you a ready-to-ship campaign, strategy, creative, channels, budget. Skim it over your morning coffee, click approve, and you're done with marketing for the week.",
  },
  {
    day: "Tuesday",
    minutes: "0 min",
    icon: Send,
    title: "Archer posts to Facebook, Instagram, GMB & TikTok, automatically.",
    desc:
      "Every post goes out at the optimal time, in your voice, with the right hashtags. You're chairside. Archer is working.",
  },
  {
    day: "Wednesday",
    minutes: "5 min",
    icon: MessageCircle,
    title: "Review replies Archer drafted in your voice.",
    desc:
      "Comments, DMs, and reviews come in, Archer drafts on-brand replies. You skim, tap approve, and your reputation keeps growing.",
  },
  {
    day: "Thursday",
    minutes: "5 min",
    icon: Inbox,
    title: "New patient leads land in your inbox.",
    desc:
      "Every click lands on a branded landing page. Inquiries flow straight to your front desk with the context they need to book.",
  },
  {
    day: "Friday",
    minutes: "5 min",
    icon: FileBarChart,
    title: "Read your one-page weekly report.",
    desc:
      "Plain English. What worked, what's next, and what Archer is doing about it. No dashboards to learn. No spreadsheets to build.",
  },
];

export function WeekWithArcher() {
  return (
    <Section id="week-with-archer" className="archer-lava-a">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>A week in your practice</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">
            Twenty minutes. <span className="text-gradient text-blue-700">A full week of marketing.</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            This is what your week actually looks like with Archer running in the background.
          </p>
        </div>
      </Reveal>

      <div className="mt-16 space-y-12">
        {days.map((d, i) => (
          <Reveal key={d.day} delay={i * 0.05}>
            <div
              className={`grid items-center gap-8 md:grid-cols-2 ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              {/* Visual */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-accent/10">
                <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {d.day} · {d.minutes}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <d.icon className="size-24 text-primary/70" />
                </div>
              </div>

              {/* Text */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-white">
                  {d.day} · {d.minutes}
                </div>
                <h3 className="mt-3 text-2xl font-bold md:text-3xl">{d.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">{d.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
