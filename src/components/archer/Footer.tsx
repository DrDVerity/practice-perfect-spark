import { Link } from "react-router-dom";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import logo from "@/assets/archer/archer-logo.png";

const cols: Array<{ title: string; links: { label: string; to: string }[] }> = [
  {
    title: "Features",
    links: [
      { label: "Campaigns & Creative", to: "/features/campaigns" },
      { label: "Reviews & Reputation", to: "/features/reviews" },
      { label: "Patient Engagement", to: "/features/engagement" },
      { label: "Enterprise & Multi-Location", to: "/features/enterprise" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why Archer", to: "/why-archer" },
      { label: "Pricing", to: "/pricing" },
      { label: "About DDF", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/" },
      { label: "Terms", to: "/" },
      { label: "HIPAA", to: "/faq" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <img src={logo} alt="Archer Dental Marketing" className="h-12 w-auto" />
            <p className="mt-3 text-xs text-muted-foreground">by Digital Dental Fusion</p>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The AI marketing director purpose-built for dental practices.
            </p>
            <div className="mt-5 flex items-center gap-3 text-muted-foreground">
              <a href="#" aria-label="Twitter" className="hover:text-foreground"><Twitter className="size-4" /></a>
              <a href="#" aria-label="LinkedIn" className="hover:text-foreground"><Linkedin className="size-4" /></a>
              <a href="#" aria-label="Instagram" className="hover:text-foreground"><Instagram className="size-4" /></a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Digital Dental Fusion. All rights reserved.</p>
          <p>Archer is HIPAA Compliant. No PHI in campaigns. Ever.</p>
        </div>
      </div>
    </footer>
  );
}
