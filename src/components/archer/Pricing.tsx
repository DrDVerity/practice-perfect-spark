import { useState } from "react";
import { Link } from "react-router-dom";
import { Section, Reveal, Eyebrow } from "./Section";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type Tier = { name: string; monthly: number | null; blurb: string; features: string[]; cta: string; highlight?: boolean; };

const tiers: Tier[] = [
  { name: "Free Trial", monthly: 0, blurb: "14 days, no card required.", features: ["Full platform access for 14 days", "Practice intelligence report", "Unlimited campaign generations", "Preview all channels", "Upgrade any time"], cta: "Start free trial" },
  { name: "Single Location", monthly: 399, blurb: "Everything for one practice.", features: ["All content generation", "Unlimited campaigns", "Multi-channel publishing (FB, IG, Google, LinkedIn)", "Branded landing pages", "Lead dashboard", "Priority support"], cta: "Choose Single Location", highlight: true },
  { name: "Group / Multi-Location", monthly: 699, blurb: "Dentist-owned groups.", features: ["Everything in Single", "Multiple locations", "Team roles & budget approvals", "Centralized brand controls", "Dedicated success manager", "SSO + advanced compliance"], cta: "Choose Group" },
];

function formatPrice(t: Tier, billing: "monthly" | "yearly") {
  if (t.monthly === null) return { price: "Custom", cadence: "" };
  if (billing === "monthly") return { price: `$${t.monthly}`, cadence: "/ month" };
  const yearly = Math.round(t.monthly * 12 * 0.85);
  return { price: `$${yearly.toLocaleString()}`, cadence: "/ year" };
}

export function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  return (
    <Section id="pricing" className="bg-secondary">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Your best marketing decision ever.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Every tier ships the same engine. Pick the surface area you need.</p>
          <div className="mt-8 inline-flex items-center rounded-full border border-border/60 bg-card p-1">
            <button type="button" onClick={() => setBilling("monthly")} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${billing === "monthly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>Monthly</button>
            <button type="button" onClick={() => setBilling("yearly")} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${billing === "yearly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>Yearly <span className="ml-1 text-xs opacity-80">(save 15%)</span></button>
          </div>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {tiers.map((t, i) => {
          const { price, cadence } = formatPrice(t, billing);
          return (
            <Reveal key={t.name} delay={i * 0.07}>
              <div className={`relative flex h-full flex-col rounded-2xl border p-8 transition-all ${t.highlight ? "border-primary/40 bg-card shadow-2xl shadow-primary/20 lg:-translate-y-3" : "border-border/60 bg-card"}`}>
                {t.highlight && (<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">Most Popular</span>)}
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t.name}</h3>
                <div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-bold">{price}</span><span className="text-sm text-muted-foreground">{cadence}</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (<li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" /><span>{f}</span></li>))}
                </ul>
                <Button className="mt-8" variant={t.highlight ? "default" : "outline"} asChild>
                  <Link to="/get-started">{t.cta}</Link>
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
