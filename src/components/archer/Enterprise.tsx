import { Section, Reveal, Eyebrow } from "./Section";
import { CalendarDays, Layers, FileBarChart2, ShieldCheck, CheckSquare, Users2, Shield, KeyRound } from "lucide-react";

const infra = [
  { icon: CalendarDays, title: "Visual Social Calendar", body: "Bird's-eye view of every post, ad, email, and review request — drag, drop, and rebalance in seconds." },
  { icon: Layers, title: "Bulk Scheduling", body: "Queue up to 500 posts at once for seasonal promos or multi-location consistency. One upload, every channel." },
  { icon: FileBarChart2, title: "White-Labeled Reports", body: "Beautiful, branded growth reports auto-delivered to the doctor's inbox every month. No spreadsheets." },
];

const collab = [
  { icon: CheckSquare, title: "One-Tap Approvals", body: "Every AI-drafted post, ad, reply, and campaign waits for the doctor or office manager's tap before it goes live." },
  { icon: Users2, title: "Team Roles & Permissions", body: "Front desk handles the inbox. Office managers run reviews. Doctors control strategy and ad spend." },
  { icon: Shield, title: "Multi-Location Controls", body: "Dentist-owned groups manage every location from one dashboard — shared brand voice, separate budgets." },
  { icon: KeyRound, title: "Audit Trail & SSO", body: "Every approval, edit, and publish is logged. SSO and 2FA keep access clean as your team grows." },
];

export function EnterpriseInfra() {
  return (
    <Section id="infrastructure">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Enterprise Infrastructure</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Built on <span className="text-gradient">enterprise-grade infrastructure.</span></h2>
          <p className="mt-4 text-lg text-muted-foreground">Archer combines the reliability of a global platform used by 13,000+ brands with the localized intelligence of Dental AI.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="size-3.5 text-primary" /> HIPAA Compliant · No PHI in campaigns
          </div>
        </div>
      </Reveal>
      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {infra.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
              <div className="relative flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="size-5" /></div>
              <h3 className="relative mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function Collaboration() {
  return (
    <Section id="collaboration" className="bg-secondary">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Collaboration & Workflow</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Built for teams. <span className="text-gradient">Designed for doctors.</span></h2>
        </div>
      </Reveal>
      <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {collab.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
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
