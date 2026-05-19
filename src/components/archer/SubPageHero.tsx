import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Eyebrow } from "./Section";
import whyArcherHero from "@/assets/archer/why-archer-hero.webp";

export function SubPageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const isWhyArcher = pathname === "/why-archer";
  return (
    <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-secondary/60 to-background px-6 pb-16 pt-32 md:pt-40">
      {isWhyArcher && (
        <>
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${whyArcherHero})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-background/60 backdrop-blur-[2px]" aria-hidden="true" />
        </>
      )}
      <div className="mx-auto max-w-4xl">
        <nav className="mb-6 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="size-3" />
          <span>{eyebrow}</span>
        </nav>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight md:text-6xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">{intro}</p>
        )}
      </div>
    </section>
  );
}
