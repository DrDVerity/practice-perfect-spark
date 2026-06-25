import { Link } from "react-router-dom";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import logo from "@/assets/archer/archer-logo.png";

const cols: Array<{ title: string; links: { label: string; to: string }[] }> = [
  {
    title: "Features",
    links: [
      { label: "AI Post Writer + Campaigns", to: "/features/campaigns" },
      { label: "Reviews & Replies", to: "/features/reviews" },
      { label: "Social Inbox (coming soon)", to: "/features/engagement" },
      { label: "Dentist-Owned Multi-Location", to: "/features/enterprise" },
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
    <footer className="border-t border-[#ffffff]/20 bg-[#001f5b] text-[#ffffff]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <img src={logo} alt="Archer Dental Marketing" className="h-20 w-auto" />
            <p className="mt-3 text-xs text-[#ffffff]/70">Archer is an Agentic subsidiary of Promethian - the Perfect Practice Partner</p>
            <p className="mt-4 max-w-xs text-sm text-[#ffffff]/80">
              The AI marketing director purpose-built for dental practices.
            </p>
            <div className="mt-5 flex items-center gap-3 text-[#ffffff]/70">
              <a href="#" aria-label="Twitter" className="hover:text-[#ffffff]"><Twitter className="size-4" /></a>
              <a href="#" aria-label="LinkedIn" className="hover:text-[#ffffff]"><Linkedin className="size-4" /></a>
              <a href="#" aria-label="Instagram" className="hover:text-[#ffffff]"><Instagram className="size-4" /></a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-semibold text-[#ffffff]">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-[#ffffff]/75 transition-colors hover:text-[#ffffff]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[#ffffff]/20 pt-6 text-xs text-[#ffffff]/70 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Digital Dental Fusion. All rights reserved.</p>
          <p>Archer is HIPAA Compliant. No PHI in campaigns. Ever.</p>
        </div>
      </div>
    </footer>
  );
}
