import { useEffect, type ReactNode } from "react";
import { Header } from "@/components/archer/Header";
import { Footer } from "@/components/archer/Footer";
import { SubPageHero } from "@/components/archer/SubPageHero";
import { SubPageCTA } from "@/components/archer/SubPageCTA";
import { Problem } from "@/components/archer/Problem";
import { ROI } from "@/components/archer/ROI";
import { WhyNow } from "@/components/archer/WhyNow";
import { Pricing } from "@/components/archer/Pricing";
import { Comparison } from "@/components/archer/Comparison";
import { FAQ } from "@/components/archer/FAQ";
import { About } from "@/components/archer/About";
import { Testimonials } from "@/components/archer/Testimonials";
import { Solution } from "@/components/archer/Solution";
import { HowItWorks } from "@/components/archer/HowItWorks";
import { Deliverables } from "@/components/archer/Deliverables";
import { Reviews } from "@/components/archer/Reviews";
import { Engagement } from "@/components/archer/Engagement";
import { EnterpriseInfra, Collaboration } from "@/components/archer/Enterprise";

function PageShell({ title, eyebrow, heroTitle, intro, children, hideCTA }: {
  title: string; eyebrow: string; heroTitle: ReactNode; intro: string; children: ReactNode; hideCTA?: boolean;
}) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="archer min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <SubPageHero eyebrow={eyebrow} title={heroTitle} intro={intro} />
        {children}
      </main>
      {!hideCTA && <SubPageCTA />}
      <Footer />
    </div>
  );
}

export function WhyArcherPage() {
  return (
    <PageShell title="Why Archer — The case for AI marketing" eyebrow="Why Archer"
      heroTitle={<>The math is <span className="text-gradient">brutal.</span></>}
      intro="Three options every practice gets handed. None work. Here's the fourth — and why the window to get out front is open right now.">
      <Problem /><ROI /><WhyNow />
    </PageShell>
  );
}
export function PricingPage() {
  return (
    <PageShell title="Pricing — Archer" eyebrow="Pricing"
      heroTitle={<>Simple pricing. <span className="text-gradient">Outsized return.</span></>}
      intro="Every tier ships the same engine. Pick the surface area you need. No long contracts, no setup fees, no agency-speak.">
      <Pricing /><Comparison />
    </PageShell>
  );
}
export function FAQPage() {
  return (
    <PageShell title="FAQ — Archer" eyebrow="FAQ"
      heroTitle={<>Questions, <span className="text-gradient">answered.</span></>}
      intro="If yours isn't here, talk to a human — we're one click away."><FAQ /></PageShell>
  );
}
export function AboutPage() {
  return (
    <PageShell title="About — Digital Dental Fusion" eyebrow="About"
      heroTitle={<>Built by people who've <span className="text-gradient">run the practice.</span></>}
      intro="Digital Dental Fusion sits at the intersection of AI engineering and dental marketing — built by operators, for operators.">
      <About /><Testimonials />
    </PageShell>
  );
}
export function ContactPage() {
  return (
    <PageShell title="Contact — Archer" eyebrow="Contact" hideCTA
      heroTitle={<>Let's <span className="text-gradient">talk.</span></>}
      intro="Drop us a note and a Digital Dental Fusion team member will reach out within one business day.">
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-8 text-center shadow-soft">
          <h2 className="text-2xl font-bold">Email us directly</h2>
          <p className="mt-3 text-muted-foreground">The fastest way to reach the team:</p>
          <a href="mailto:hello@digitaldentalfusion.com" className="mt-4 inline-block text-lg font-semibold text-primary underline">hello@digitaldentalfusion.com</a>
          <p className="mt-6 text-sm text-muted-foreground">Mon–Fri, 9am–6pm ET</p>
        </div>
      </section>
    </PageShell>
  );
}
export function FeaturesCampaignsPage() {
  return (
    <PageShell title="Campaigns & Creative — Archer" eyebrow="Campaigns & Creative"
      heroTitle={<>The campaign engine, <span className="text-gradient">end to end.</span></>}
      intro="Archer reads your practice, writes the strategy, designs the creative, builds the landing page, and ships the campaign across every channel — on schedule, on brand, every week.">
      <Solution /><HowItWorks /><Deliverables />
    </PageShell>
  );
}
export function FeaturesReviewsPage() {
  return (
    <PageShell title="Reviews & Reputation — Archer" eyebrow="Reviews & Reputation"
      heroTitle={<>Every visit, a <span className="text-gradient">5-star opportunity.</span></>}
      intro="Archer asks for reviews at the right moment, replies in your voice, flags urgent issues for your front desk, and turns top reviews into evergreen marketing.">
      <Reviews />
    </PageShell>
  );
}
export function FeaturesEngagementPage() {
  return (
    <PageShell title="Patient Engagement — Archer" eyebrow="Patient Engagement"
      heroTitle={<>Conversations that <span className="text-gradient">never sleep.</span></>}
      intro="Archer talks to prospective patients on every channel they use, drafts replies in your voice, and syncs with your PMS to fill cancellations in real time.">
      <Engagement />
    </PageShell>
  );
}
export function FeaturesEnterprisePage() {
  return (
    <PageShell title="Enterprise & Multi-Location — Archer" eyebrow="Enterprise & Multi-Location"
      heroTitle={<>Built for groups. <span className="text-gradient">Trusted by enterprise.</span></>}
      intro="Archer rides on infrastructure trusted by 13,000+ brands — with the governance, audit, and multi-location controls DSOs and growing groups demand.">
      <EnterpriseInfra /><Collaboration />
    </PageShell>
  );
}
