import { Section, Reveal, Eyebrow } from "./Section";
import { TrendingUp, Users, DollarSign, Clock } from "lucide-react";

const months = [
  { m: "M1", patients: 6 }, { m: "M2", patients: 11 }, { m: "M3", patients: 17 },
  { m: "M4", patients: 22 }, { m: "M5", patients: 28 }, { m: "M6", patients: 33 },
  { m: "M7", patients: 38 }, { m: "M8", patients: 42 }, { m: "M9", patients: 46 },
  { m: "M10", patients: 49 }, { m: "M11", patients: 52 }, { m: "M12", patients: 55 },
];
const NEW_PATIENT_VALUE = 1200;
const MONTHLY_COST = 499;

function GrowthChart() {
  const w = 720, h = 280, padX = 40, padY = 30;
  const maxP = Math.max(...months.map((d) => d.patients));
  const stepX = (w - padX * 2) / (months.length - 1);
  const yFor = (v: number) => h - padY - (v / maxP) * (h - padY * 2);
  const points = months.map((d, i) => [padX + i * stepX, yFor(d.patients)] as const);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${h - padY} L ${points[0][0]} ${h - padY} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Projected new patients per month">
      <defs><linearGradient id="archerArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.35" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75, 1].map((t) => (<line key={t} x1={padX} x2={w - padX} y1={h - padY - t * (h - padY * 2)} y2={h - padY - t * (h - padY * 2)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 4" />))}
      <path d={areaPath} fill="url(#archerArea)" className="text-primary" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      {points.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="4" className="fill-background" stroke="currentColor" strokeWidth="2" />))}
      {months.map((d, i) => (<text key={d.m} x={padX + i * stepX} y={h - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="11">{d.m}</text>))}
      {[0, 0.5, 1].map((t) => (<text key={t} x={padX - 8} y={h - padY - t * (h - padY * 2) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">{Math.round(t * maxP)}</text>))}
    </svg>
  );
}

function CostVsRevenue() {
  const data = months.map((d) => ({ m: d.m, cost: MONTHLY_COST, revenue: d.patients * NEW_PATIENT_VALUE }));
  const w = 720, h = 280, padX = 44, padY = 30;
  const max = Math.max(...data.map((d) => d.revenue));
  const stepX = (w - padX * 2) / data.length;
  const barW = stepX * 0.36;
  const yFor = (v: number) => h - padY - (v / max) * (h - padY * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Cost vs revenue">
      {[0.25, 0.5, 0.75, 1].map((t) => (<line key={t} x1={padX} x2={w - padX} y1={h - padY - t * (h - padY * 2)} y2={h - padY - t * (h - padY * 2)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 4" />))}
      {data.map((d, i) => {
        const cx = padX + i * stepX + stepX / 2;
        return (<g key={d.m}>
          <rect x={cx - barW - 2} y={yFor(d.cost)} width={barW} height={h - padY - yFor(d.cost)} rx="3" className="fill-accent" />
          <rect x={cx + 2} y={yFor(d.revenue)} width={barW} height={h - padY - yFor(d.revenue)} rx="3" className="fill-primary" />
          <text x={cx} y={h - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="11">{d.m}</text>
        </g>);
      })}
      {[0, 0.5, 1].map((t) => (<text key={t} x={padX - 8} y={h - padY - t * (h - padY * 2) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">${Math.round((t * max) / 1000)}k</text>))}
    </svg>
  );
}

const stats = [
  { icon: Clock, label: "Payback period", value: "< 30 days", note: "First few new patients cover the monthly subscription within weeks." },
  { icon: Users, label: "New patients / yr", value: "+55", note: "Net new patients added in year one for a single-location practice." },
  { icon: DollarSign, label: "Year-one revenue", value: "$66K", note: "55 new patients × $1,200 average first-year value." },
  { icon: TrendingUp, label: "ROI multiple", value: "11×", note: "$66,000 year-one revenue ÷ $5,988 annual Archer cost." },
];

export function ROI() {
  return (
    <Section id="roi" className="bg-secondary">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>The ROI</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">What to expect. <span className="text-gradient">Month by month.</span></h2>
          <p className="mt-4 text-lg text-muted-foreground">Archer compounds. Campaigns get smarter, reviews stack up, and your local search footprint grows every week. Here's the realistic curve a single-location practice sees in year one.</p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><s.icon className="size-5" /></div>
              <div className="mt-5 text-3xl font-bold text-gradient">{s.value}</div>
              <div className="mt-1 text-sm font-semibold">{s.label}</div>
              <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex items-baseline justify-between gap-4">
              <div><h3 className="text-lg font-semibold">New patients per month</h3><p className="text-sm text-muted-foreground">Compounding growth as campaigns learn your market.</p></div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">+55 / yr</span>
            </div>
            <div className="mt-4"><GrowthChart /></div>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="h-full rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex items-baseline justify-between gap-4">
              <div><h3 className="text-lg font-semibold">Cost vs. revenue, monthly</h3><p className="text-sm text-muted-foreground">$499/mo subscription vs. revenue at $1,200/patient.</p></div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="size-2.5 rounded-sm bg-accent" /> Cost</span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="size-2.5 rounded-sm bg-primary" /> Revenue</span>
              </div>
            </div>
            <div className="mt-4"><CostVsRevenue /></div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
