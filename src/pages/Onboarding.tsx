import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Globe,
  Sparkles,
  ShieldCheck,
  Check,
  Target,
  Users,
  CalendarClock,
  Share2,
  Rocket,
  FileText,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingReports } from "@/hooks/useOnboardingReports";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProcessingTerminal } from "@/components/onboarding/ProcessingTerminal";
import { scanScript } from "@/components/onboarding/onboarding-scripts";

type Step = "welcome" | "identity" | "scanning" | "reveal" | "roadmap";

const RAIL: { key: Step; label: string }[] = [
  { key: "identity", label: "Practice" },
  { key: "scanning", label: "Scan" },
  { key: "reveal", label: "Insights" },
  { key: "roadmap", label: "Launch" },
];

const GOAL_PRESETS = [
  "Attract new patients",
  "Promote teeth whitening",
  "Fill the schedule",
  "Grow reviews",
  "Launch a specialty service",
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { state: reportState, trigger } = useOnboardingReports(user?.id ?? null);

  const [step, setStep] = useState<Step>("welcome");
  const [practiceName, setPracticeName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [scanDone, setScanDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const prefilled = useRef(false);

  // Require auth.
  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  // Prefill from any existing profile so returning users are not re-asked.
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("practice_name, website_url, campaign_focus, target_audience")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPracticeName(data.practice_name ?? "");
        setWebsiteUrl(data.website_url ?? "");
        setGoal(data.campaign_focus ?? "");
        setAudience(data.target_audience ?? "");
      }
    })();
  }, [user]);

  const railIndex = useMemo(() => RAIL.findIndex((r) => r.key === step), [step]);

  const normalizedUrl = useMemo(() => {
    const u = websiteUrl.trim();
    if (!u) return "";
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  }, [websiteUrl]);

  const canScan = practiceName.trim().length > 1 && websiteUrl.trim().length > 3;

  // The real job behind the scan animation: persist identity, kick off research.
  async function runScan() {
    if (!user || !canScan) return;
    setStep("scanning");
    setScanDone(false);
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("profiles").upsert(
        {
          user_id: user.id,
          email: user.email,
          practice_name: practiceName.trim(),
          website_url: normalizedUrl,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      // Best-effort: start the background research suite. It may return
      // 'awaiting_social' / 'missing_website'; that is fine, we proceed.
      trigger.mutate({ silent: true });
    } catch (err: any) {
      toast.error("Could not save your practice", { description: err?.message });
    } finally {
      setSaving(false);
      setScanDone(true); // signal the terminal it can wrap up
    }
  }

  async function saveGoals(next: Step) {
    if (!user) return;
    try {
      await (supabase as any)
        .from("profiles")
        .update({
          campaign_focus: goal.trim() || null,
          target_audience: audience.trim() || null,
        })
        .eq("user_id", user.id);
    } catch {
      /* non-blocking */
    }
    setStep(next);
  }

  if (authLoading) {
    return (
      <div className="archer-onb flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="archer-onb archer-onb-grid relative min-h-screen overflow-hidden">
      {/* ambient gold bloom */}
      <div
        className="onb-bloom pointer-events-none absolute inset-x-0 bottom-[-20%] -z-0 mx-auto h-[420px] max-w-3xl rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(187,154,79,0.28), transparent)" }}
        aria-hidden="true"
      />

      {/* top chrome */}
      <header className="onb-chrome relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <ArcherMark />
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight">Archer</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold">
              AI Dental Marketing
            </div>
          </div>
        </div>
        {railIndex >= 0 && <Rail index={railIndex} />}
        <a
          href="/contact"
          className="hidden items-center gap-1.5 text-sm text-ink-300 transition-colors hover:text-white sm:flex"
        >
          <HelpCircle className="h-4 w-4" /> Need help?
        </a>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl items-center px-5 py-10 sm:px-8">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <StepShell key="welcome">
              <div className="mx-auto max-w-2xl text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease }}
                  className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl onb-glass-gold"
                >
                  <Sparkles className="h-7 w-7 text-gold-300" />
                </motion.div>
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-gold">
                  Welcome to Archer
                </p>
                <h1 className="text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  Let&apos;s set up your practice
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-300">
                  In about two minutes, Archer will study your website, learn your brand, and build a
                  marketing plan you can launch the same day.
                </p>
                <div className="mt-9 flex flex-col items-center gap-3">
                  <button
                    onClick={() => setStep("identity")}
                    className="gold-cta inline-flex h-12 items-center gap-2 rounded-xl px-7 text-base font-semibold"
                  >
                    Get started <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem("archer_skip_onboarding", "1");
                      navigate("/dashboard");
                    }}
                    className="text-sm text-ink-300 transition-colors hover:text-white"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </StepShell>
          )}

          {step === "identity" && (
            <StepShell key="identity">
              <div className="grid w-full items-center gap-10 md:grid-cols-[300px_1fr]">
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease }}
                  className="hidden md:block"
                >
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/40">
                    <Sparkles className="h-7 w-7 text-gold" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold leading-tight">
                    We&apos;ll scan your website
                  </h2>
                  <p className="mt-3 text-ink-300">
                    Archer analyzes your practice and builds a custom marketing strategy from what it
                    finds.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-sm text-ink-300">
                    <ShieldCheck className="h-5 w-5 text-gold" /> Your data is secure and never shared.
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease }}
                  className="onb-glass-gold rounded-3xl p-7 sm:p-10"
                >
                  <div className="text-center">
                    <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                      Let&apos;s learn about your practice
                    </h1>
                    <p className="mt-3 text-ink-300">
                      Enter your details and we&apos;ll scan your website to get started.
                    </p>
                  </div>

                  <form
                    className="mt-8 space-y-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (canScan) runScan();
                    }}
                  >
                    <Field label="Practice name" icon={<Building2 className="h-4 w-4" />}>
                      <input
                        autoFocus
                        value={practiceName}
                        onChange={(e) => setPracticeName(e.target.value)}
                        placeholder="e.g. Bright Smiles Dental"
                        className="onb-input h-12 w-full rounded-xl pl-11 pr-4 text-base"
                      />
                    </Field>
                    <Field label="Website URL" icon={<Globe className="h-4 w-4" />}>
                      <input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="e.g. www.brightsmilesdental.com"
                        className="onb-input h-12 w-full rounded-xl pl-11 pr-4 text-base"
                        inputMode="url"
                      />
                    </Field>

                    <button
                      type="submit"
                      disabled={!canScan}
                      className="gold-cta flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold"
                    >
                      <Sparkles className="h-4 w-4" /> Scan my practice
                    </button>
                    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-300">
                      <ShieldCheck className="h-3.5 w-3.5" /> We only scan publicly available
                      information.
                    </p>
                  </form>
                </motion.div>
              </div>
            </StepShell>
          )}

          {step === "scanning" && (
            <StepShell key="scanning">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-6 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
                    Analyzing {practiceName || "your practice"}
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                    Reading your practice
                  </h1>
                </div>
                <ProcessingTerminal
                  steps={scanScript(normalizedUrl, practiceName)}
                  running
                  done={scanDone}
                  minDurationMs={7200}
                  etaLabel="about 15 seconds"
                  title={`archer://scan ${practiceName || ""}`.trim()}
                  onComplete={() => setStep("reveal")}
                />
              </div>
            </StepShell>
          )}

          {step === "reveal" && (
            <StepShell key="reveal">
              <RevealStep
                practiceName={practiceName}
                websiteUrl={normalizedUrl}
                goal={goal}
                setGoal={setGoal}
                audience={audience}
                setAudience={setAudience}
                reportDone={reportState?.done ?? 0}
                reportTotal={reportState?.total ?? 10}
                reportRunning={reportState?.status === "running"}
                onContinue={() => saveGoals("roadmap")}
              />
            </StepShell>
          )}

          {step === "roadmap" && (
            <StepShell key="roadmap">
              <RoadmapStep navigate={navigate} practiceName={practiceName} />
            </StepShell>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ---------- shared bits ---------- */

function StepShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block text-left">
      <span className="mb-2 block text-sm font-medium text-[color:var(--ink-050)]">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

function Rail({ index }: { index: number }) {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {RAIL.map((s, i) => {
        const complete = i < index;
        const active = i === index;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
                  complete
                    ? "border-transparent bg-[linear-gradient(180deg,#E8C96C,#BB9A4F)] text-[#1a1206] glow-gold-sm"
                    : active
                    ? "border-gold text-gold glow-gold-sm"
                    : "border-white/15 text-ink-300"
                }`}
              >
                {complete ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${active ? "text-gold" : "text-ink-300"}`}
              >
                {s.label}
              </span>
            </div>
            {i < RAIL.length - 1 && (
              <div className={`mx-1 h-px w-8 ${complete ? "bg-gold" : "bg-white/15"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ArcherMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg onb-glass-gold">
      <Rocket className="h-4 w-4 text-gold-300" />
    </div>
  );
}

/* ---------- reveal step ---------- */

function RevealStep({
  practiceName,
  websiteUrl,
  goal,
  setGoal,
  audience,
  setAudience,
  reportDone,
  reportTotal,
  reportRunning,
  onContinue,
}: {
  practiceName: string;
  websiteUrl: string;
  goal: string;
  setGoal: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  reportDone: number;
  reportTotal: number;
  reportRunning: boolean;
  onContinue: () => void;
}) {
  const domain = websiteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const found = [
    "Website and services read",
    "Brand voice captured",
    "Patient reviews collected",
    "Local competitors analyzed",
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Scan complete</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Here&apos;s what we learned
        </h1>
        <p className="mt-3 text-ink-300">
          {practiceName ? `${practiceName} ` : "Your practice "}is ready. Confirm a goal and Archer
          will tailor everything to it.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {/* what we found */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease }}
          className="onb-glass rounded-2xl p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-gold" />
            <span className="font-mono text-gold-300">{domain || "your practice"}</span>
          </div>
          <ul className="space-y-3">
            {found.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, ease }}
                className="flex items-center gap-2.5 text-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15">
                  <Check className="h-3 w-3 text-gold" />
                </span>
                {f}
              </motion.li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-xs text-ink-300">
              <span className="flex items-center gap-1.5">
                {reportRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-gold" />
                )}
                Research reports
              </span>
              <span className="font-mono">
                {Math.min(reportDone, reportTotal)}/{reportTotal}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-300">
              {reportRunning
                ? "Deep research is running in the background. You can keep going."
                : "We'll keep enriching your knowledge base as you work."}
            </p>
          </div>
        </motion.div>

        {/* set goal */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease }}
          className="onb-glass-gold rounded-2xl p-6"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-gold" /> What should we focus on first?
          </div>
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                  goal === g
                    ? "border-gold bg-gold/15 text-gold-300 glow-gold-sm"
                    : "border-white/12 text-ink-300 hover:border-white/30"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Or type your own goal"
            className="onb-input mt-4 h-11 w-full rounded-xl px-4 text-sm"
          />

          <div className="mb-3 mt-6 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-gold" /> Who are you trying to reach?
          </div>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. Families and new patients within 10 miles"
            className="onb-input h-11 w-full rounded-xl px-4 text-sm"
          />

          <button
            onClick={onContinue}
            className="gold-cta mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold"
          >
            Build my launch plan <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- roadmap / handoff ---------- */

function RoadmapStep({
  navigate,
  practiceName,
}: {
  navigate: (to: string) => void;
  practiceName: string;
}) {
  const items = [
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "Create your first campaign",
      desc: "Archer's AI strategist drafts a full plan from your practice profile.",
      cta: "Start a campaign",
      to: "/dashboard",
      primary: true,
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Generate content",
      desc: "Turn the plan into posts, images, and captions for every channel.",
      cta: "Open dashboard",
      to: "/dashboard",
    },
    {
      icon: <CalendarClock className="h-5 w-5" />,
      title: "Schedule your posts",
      desc: "Pick optimal times on the calendar, or let Archer choose.",
      cta: "Open calendar",
      to: "/schedule",
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      title: "Connect a social account",
      desc: "Link Facebook, Instagram, or LinkedIn so Archer can publish for you.",
      cta: "Connect",
      to: "/dashboard",
    },
    {
      icon: <Rocket className="h-5 w-5" />,
      title: "Publish and grow",
      desc: "Approve, publish, and watch your first campaign go live.",
      cta: "Go live",
      to: "/dashboard",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl onb-glass-gold">
          <Rocket className="h-7 w-7 text-gold-300" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">You&apos;re all set</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Your launch plan is ready
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-300">
          Here&apos;s the path from here to your first published post. Do it now, or come back any
          time. Your dashboard tracks every step.
        </p>
      </motion.div>

      <div className="mt-8 space-y-3">
        {items.map((it, i) => (
          <motion.button
            key={it.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 + i * 0.07, ease }}
            onClick={() => navigate(it.to)}
            className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all ${
              it.primary ? "onb-glass-gold" : "onb-glass hover:border-white/20"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                it.primary ? "bg-gold/20 text-gold-300" : "bg-white/5 text-gold"
              }`}
            >
              {it.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{it.title}</span>
                {it.primary && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold-300">
                    Next
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-sm text-ink-300">{it.desc}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-gold opacity-80 transition-opacity group-hover:opacity-100">
              {it.cta} <ArrowRight className="h-4 w-4" />
            </span>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="gold-cta inline-flex h-12 items-center gap-2 rounded-xl px-7 text-base font-semibold"
        >
          Go to my dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
