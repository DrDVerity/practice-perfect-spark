import { Section, Reveal, Eyebrow } from "./Section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Does Archer post to my actual social accounts?", a: "Yes. You connect Facebook, Instagram, Google Business, LinkedIn, and email once. After that Archer schedules and publishes directly. You can review and approve before each push, or let it run on auto-pilot." },
  { q: "Is my patient data safe? Is this HIPAA Compliant?", a: "Archer is built HIPAA Compliant. No PHI ever flows into campaigns, we only use marketing data (your website, public reviews, brand assets). Patient data stays in your practice management system, not in our models." },
  { q: "How is this different from hiring an agency?", a: "An agency takes 60 days to ramp, charges $3–8K a month, and assigns a junior account manager. Archer ships your first campaign the same week, costs a fraction, was trained specifically on the dental marketing domain, and pairs you with an experienced human account manager." },
  { q: "Do I need any marketing experience?", a: "None. The intake walks you through a 20-minute questionnaire in plain language. Archer handles strategy, creative, channels, and reporting. You spend 20 minutes a week reviewing and approving." },
  { q: "What if I already have a website or a marketer?", a: "Archer plays nicely with both. It can publish to your existing site, complement an in-house marketer (most use it to 10x their output), or fully replace an underperforming agency." },
  { q: "Can I edit what Archer creates before it posts?", a: "Always. Every campaign, ad, and post is editable inline before it ships. You can also lock in brand guardrails, words and claims Archer must avoid, so nothing goes out off-brand." },
  { q: "What channels are supported?", a: "Facebook, Instagram, Google Business, Google Ads, LinkedIn, email, and on-site blog/landing pages. We add new channels based on what's actually working for dental practices." },
  { q: "Cancellation and refunds?", a: "Month-to-month. Cancel anytime in one click. If your first 30 days don't ship at least one full campaign you're proud of, we'll refund you in full." },
];

export function FAQ() {
  return (
    <Section id="faq">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Questions, answered.</h2>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/60 bg-card px-6 shadow-soft">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Reveal>
    </Section>
  );
}
