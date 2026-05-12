import { Section, Reveal, Eyebrow } from "./Section";
import { Check, X } from "lucide-react";

const cols = ["Archer", "Agency", "In-House", "DIY"] as const;
const rows: Array<{ label: string; vals: [string, string, string, string] }> = [
  { label: "Cost", vals: ["From $499 / mo", "$3K–$8K / mo", "$65K+ / yr", "$0 (your time)"] },
  { label: "Time required", vals: ["20 min / week", "Meetings & approvals", "Full-time manage", "10+ hrs / week"] },
  { label: "Strategy quality", vals: ["Practice-specific AI", "Templated", "Variable", "Guesswork"] },
  { label: "Speed to launch", vals: ["Same week", "60 days", "30 days", "Whenever"] },
  { label: "Consistency", vals: ["yes", "no", "no", "no"] },
  { label: "Multi-channel", vals: ["yes", "partial", "partial", "no"] },
  { label: "Lead capture", vals: ["yes", "partial", "no", "no"] },
  { label: "Reporting", vals: ["Live dashboard", "Monthly PDF", "Spreadsheet", "None"] },
  { label: "Data transparency", vals: ["yes", "no", "partial", "no"] },
  { label: "24/7 availability", vals: ["yes", "no", "no", "no"] },
];
const redValues = new Set(["$3K–$8K / mo", "$65K+ / yr", "10+ hrs / week"]);

function Cell({ value, highlight }: { value: string; highlight?: boolean }) {
  if (value === "yes") return (<span className={`inline-flex size-7 items-center justify-center rounded-full ${highlight ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}><Check className="size-4" /></span>);
  if (value === "no") return (<span className="inline-flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground"><X className="size-4" /></span>);
  if (value === "partial") return <span className="text-xs text-muted-foreground">Partial</span>;
  if (redValues.has(value)) return <span className="text-sm font-medium text-destructive">{value}</span>;
  return <span className={`text-sm ${highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}>{value}</span>;
}

export function Comparison() {
  return (
    <Section id="compare">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>The Math</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">What you're paying today vs. what Archer costs.</h2>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-14 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-border/60"><th className="p-5 font-medium text-muted-foreground"></th>
                {cols.map((c) => (<th key={c} className={`p-5 font-semibold ${c === "Archer" ? "bg-primary/5 text-primary" : "text-muted-foreground"}`}>{c}</th>))}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-border/50 last:border-0">
                    <td className="p-5 font-medium">{r.label}</td>
                    {r.vals.map((v, i) => (<td key={i} className={`p-5 ${cols[i] === "Archer" ? "bg-primary/5" : ""}`}><Cell value={v} highlight={cols[i] === "Archer"} /></td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
