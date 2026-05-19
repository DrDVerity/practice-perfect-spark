import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/archer/archer-logo.png";

const featureLinks = [
  { to: "/features/campaigns", label: "AI Post Writer + Campaigns", desc: "Captions, ads, images, landing pages" },
  { to: "/features/reviews", label: "Reviews & Replies", desc: "Automated requests + AI replies" },
  { to: "/features/engagement", label: "Social Inbox", desc: "Comments + DMs in one place — coming soon" },
  { to: "/features/enterprise", label: "Dentist-Owned Multi-Location", desc: "Per-location voice, shared brand controls" },
];

const mainNav = [
  { to: "/experience", label: "Client Experience" },
  { to: "/pricing", label: "Pricing" },
  { to: "/why-archer", label: "Why Archer" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const whiteMenu = pathname === "/why-archer" && !scrolled;
  const linkClass = whiteMenu
    ? "text-sm text-white/90 transition-colors hover:text-white"
    : "text-sm text-muted-foreground transition-colors hover:text-foreground";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass border-b border-border/60" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="Archer Dental Marketing" className="h-9 w-auto" />
          <span className="sr-only">Archer — Dental Marketing</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className={`inline-flex items-center gap-1 ${linkClass}`}>
              Features <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {featureLinks.map((f) => (
                <DropdownMenuItem key={f.to} asChild>
                  <Link to={f.to} className="flex flex-col items-start gap-0.5 py-2">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {mainNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={linkClass}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <ThemeToggle />
              <Button size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <ThemeToggle />
              <Button size="sm" asChild className="shadow-md shadow-primary/20">
                <Link to="/get-started">Get a Campaign</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            className="rounded-md p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass border-t border-border/60 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Features
            </div>
            {featureLinks.map((f) => (
              <Link
                key={f.to}
                to={f.to}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {f.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-border/60 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </div>
            {mainNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <Button size="sm" asChild className="mt-2">
              <Link to={user ? "/dashboard" : "/get-started"} onClick={() => setOpen(false)}>
                {user ? "Dashboard" : "Get a Campaign"}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
