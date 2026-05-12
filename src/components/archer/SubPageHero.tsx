import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Eyebrow } from "./Section";

export function SubPageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-secondary/60 to-background px-6 pb-16 pt-32 md:pt-40">
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
