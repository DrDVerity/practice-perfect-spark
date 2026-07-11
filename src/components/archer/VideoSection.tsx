import { Section, Reveal, Eyebrow } from "./Section";
import heroBgMp4 from "@/assets/archer/hero-bg.mp4";
import heroBgWebm from "@/assets/archer/hero-bg.webm";
import heroPoster from "@/assets/archer/hero-bg-poster.jpg";

export function VideoSection() {
  return (
    <Section id="video" className="archer-section-navy archer-section-divider pt-0 md:pt-0">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>
            <span className="text-gradient">See Archer in action</span>
          </Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-5xl">
            Watch what Archer does for your practice
          </h2>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="relative mx-auto mt-12 w-full max-w-5xl">
          {/* Browser-style window framing the product montage */}
          <div className="overflow-hidden rounded-2xl border border-border bg-neutral-900 shadow-2xl shadow-primary/20">
            <div className="flex items-center gap-2 border-b border-white/10 bg-neutral-950 px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f56]" />
              <span className="size-3 rounded-full bg-[#ffbd2e]" />
              <span className="size-3 rounded-full bg-[#27c93f]" />
              <span className="ml-3 truncate font-mono text-xs text-white/40">archer.app</span>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={heroPoster}
                aria-label="A look inside Archer"
                className="h-full w-full object-cover"
              >
                <source src={heroBgWebm} type="video/webm" />
                <source src={heroBgMp4} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
