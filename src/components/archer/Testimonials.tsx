import { Section, Reveal, Eyebrow } from "./Section";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import a1 from "@/assets/archer/avatar1.jpg";
import a2 from "@/assets/archer/avatar2.jpg";
import a3 from "@/assets/archer/avatar3.jpg";
import a4 from "@/assets/archer/avatar4.jpg";
import a5 from "@/assets/archer/avatar5.jpg";

const tests = [
  { quote: "I got my Sundays back. Archer ships a month of campaigns in the time it used to take me to write a single Instagram caption.", name: "Dr. Sarah K., DDS", practice: "Austin, TX", avatar: a1 },
  { quote: "New patient bookings are up 38% in two quarters. I haven't opened Canva once. I'm not sure I remember how.", name: "Dr. Marcus L., DMD", practice: "Charlotte, NC", avatar: a2 },
  { quote: "We fired our agency. Archer does the same work, faster, and it actually sounds like our practice instead of a template.", name: "Dr. Imani O., DDS", practice: "Atlanta, GA", avatar: a3 },
  { quote: "Our Google reviews doubled in the first 90 days. The replies sound like me, patients keep mentioning how personal they feel.", name: "Dr. James G., DMD", practice: "Santa Barbara, CA", avatar: a4 },
  { quote: "Two locations, one dashboard, zero agency calls. Archer pays for itself before the second new patient walks in the door.", name: "Dr. Michael W., DDS", practice: "Salt Lake City, UT", avatar: a5 },
];

export function Testimonials() {
  return (
    <Section id="testimonials">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Trusted by Practices</Eyebrow>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl">Reclaimed time. Real patient flow.</h2>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <Carousel opts={{ align: "start", loop: true }} className="mt-14 w-full">
          <CarouselContent className="-ml-4">
            {tests.map((t) => (
              <CarouselItem key={t.name} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <figure className="h-full rounded-2xl border border-border/60 bg-card/70 p-7 backdrop-blur shadow-soft">
                  <blockquote className="text-foreground"><p className="text-base leading-relaxed">"{t.quote}"</p></blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-5">
                    <img src={t.avatar} alt={t.name} width={48} height={48} loading="lazy" className="size-12 rounded-full object-cover" />
                    <div><div className="text-sm font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.practice}</div></div>
                  </figcaption>
                </figure>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-8 flex items-center justify-center gap-3">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        </Carousel>
      </Reveal>
    </Section>
  );
}
