import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle } from "lucide-react";

export function SubPageCTA() {
  return (
    <section className="border-t border-border/60 bg-secondary px-6 py-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">Still have questions?</h2>
        <p className="max-w-xl text-muted-foreground">
          Get a free practice report and full sample campaign in under 20 minutes, or talk to a real human on our team.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-12 px-6" asChild>
            <Link to="/get-started"><Sparkles className="mr-1.5 size-5" /> See Archer Build a Campaign</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6" asChild>
            <Link to="/contact"><MessageCircle className="mr-1.5 size-5" /> Talk to a human</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
