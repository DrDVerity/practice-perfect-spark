import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/archer/Header";
import { Hero } from "@/components/archer/Hero";
import { VideoSection } from "@/components/archer/VideoSection";
import { Section, Reveal, Eyebrow } from "@/components/archer/Section";
import { Footer } from "@/components/archer/Footer";
import { PainReveal } from "@/components/archer/PainReveal";
import { PersonaMarquee } from "@/components/archer/PersonaMarquee";
import { WithWithoutArcher } from "@/components/archer/WithWithoutArcher";
import { ProductShotStrip } from "@/components/archer/ProductShotStrip";
import { EverythingYouNeed } from "@/components/archer/EverythingYouNeed";
import { Button } from "@/components/ui/button";
import { Megaphone, Star, Inbox, Building2, ArrowRight, Check, X, ShieldCheck, Sparkles } from "lucide-react";

const problems = [
  "Agency: $3K–$8K/mo, 60-day onboarding, junior account manager",
  "In-house: $65K+ salary, plus tools, plus 18-month tenure",
  "DIY: 10+ hours a week of inconsistent posting and guesswork",
];
const promises = [
  "20 minutes a week. One AI marketing director.",
  "Practice-trained — not generic SaaS or templated agency copy",
  "Ships your first full campaign the same week",
];
const tiles = [
  { icon: Megaphone, title: "AI Post Writer + Campaigns", desc: "Captions, hashtags, ad copy, images, video, and branded landing pages — published to every channel on schedule.", to: "/features/campaigns" },
  { icon: Star, title: "Reviews & Replies", desc: "Automated review requests, AI-drafted replies, sentiment triage, and review-driven marketing.", to: "/features/reviews" },
  { icon: Inbox, title: "Social Inbox", desc: "Comments and DMs from every channel in one place, with AI-drafted replies. Coming soon.", to: "/features/engagement" },
  { icon: Building2, title: "Dentist-Owned Multi-Location", desc: "Per-location voice, shared brand controls, role-based approvals, and white-labeled reports — built for partner-owned groups.", to: "/features/enterprise" },
];
const tiers = [
  { name: "Starter", price: "$499", blurb: "Single location, core channels." },
  { name: "Growth", price: "$750", blurb: "Most practices pick this one.", highlight: true },
  { name: "Multi-Location", price: "Custom", blurb: "Dentist-owned groups, every location." },
];

export default function ArcherHome() {
  useEffect(() => { document.title = "Archer — AI Marketing Director for Dental Practices"; }, []);
  return (
    <div className="archer min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <VideoSection />
        <PainReveal />
        <PersonaMarquee />

        <Section id="problem-promise" className="archer-section-dark archer-section-divider">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>Why Archer exists</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">Three bad options. <span className="text-gradient">One better one.</span></h2>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-destructive bg-card p-7">
                <h3 className="text-lg font-semibold">What dentists do today</h3>
                <ul className="mt-5 space-y-3">
                  {problems.map((p) => (<li key={p} className="flex items-start gap-2 text-sm text-muted-foreground"><X className="mt-0.5 size-4 shrink-0 text-destructive" /><span>{p}</span></li>))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-2xl border border-primary bg-card p-7 shadow-xl shadow-primary/10">
                <h3 className="text-lg font-semibold">What Archer does</h3>
                <ul className="mt-5 space-y-3">
                  {promises.map((p) => (<li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{p}</span></li>))}
                </ul>
                <Button className="mt-6" variant="outline" size="sm" asChild>
                  <Link to="/why-archer">See the full case <ArrowRight className="ml-1 size-4" /></Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </Section>

        <section className="archer-section-navy archer-section-divider px-6 py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-3">
            <div className="text-center md:text-left">
            <div className="text-4xl font-bold text-gradient">11×</div>
            <p className="mt-1 text-sm text-white/80">Year-one ROI vs. Archer subscription. <Link to="/why-archer" className="underline">See the math →</Link></p>
            </div>
            <blockquote className="text-center text-sm italic text-muted-foreground md:text-left">
              "We fired our agency. Archer does the same work, faster, and it actually sounds like our practice." — Dr. Imani O., DDS
            </blockquote>
            <div className="flex flex-wrap justify-center gap-3 md:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs"><ShieldCheck className="size-3.5 text-accent" /> HIPAA Compliant</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs"><Sparkles className="size-3.5 text-accent" /> 13,000+ brands</span>
            </div>
          </div>
        </section>

        <Section id="features" className="archer-section-navy archer-section-divider">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>What Archer does</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">One platform. Four jobs. <br /><span style={{ color: '#FFD700' }}>Rocketing ROI.</span></h2>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {tiles.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06}>
                <Link to={t.to} className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-7 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><t.icon className="size-5" /></div>
                  <h3 className="mt-5 text-xl font-semibold">{t.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">Learn more <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>

        <ProductShotStrip />
        <EverythingYouNeed />
        <WithWithoutArcher />

        <Section id="pricing-teaser" className="archer-section-navy-gold archer-section-divider">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">Your best marketing decision ever.</h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className={`rounded-2xl border border-border/60 bg-card p-6 ${t.highlight ? "border-primary/40 shadow-xl shadow-primary/15" : ""}`}>
                <div className="text-sm font-semibold uppercase tracking-wider text-primary">{t.name}</div>
                <div className="mt-2 text-3xl font-bold text-foreground">{t.price}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild size="lg" className="bg-[#BB9A4F] text-[#001f5b] hover:bg-[#BB9A4F]/90"><Link to="/pricing">See full pricing & comparison <ArrowRight className="ml-1 size-4" /></Link></Button>
          </div>
        </Section>

        <section id="cta" className="archer-section-navy-gold relative overflow-hidden px-6 py-28 md:py-36">

          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-5xl font-bold tracking-tight md:text-6xl">Stop guessing. <span className="text-gradient">Start growing.</span></h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">Give Archer 20 minutes. Get a full campaign back — practice report, strategy, creative, landing pages — free.</p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" className="h-12 px-6 text-base bg-[#BB9A4F] text-[#001f5b] hover:bg-[#BB9A4F]/90 shadow-xl shadow-black/20" asChild>
                  <Link to="/get-started">See Archer Build a Campaign <ArrowRight className="ml-1 size-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base border-white/30 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link to="/contact"><Sparkles className="mr-1 size-5 text-[#BB9A4F]" /> <span className="text-white">Talk to a human</span></Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-white/70">No credit card. No 60-day onboarding. No agency-speak.</p>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
