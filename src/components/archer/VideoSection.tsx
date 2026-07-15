import { useState, useRef } from "react";
import { Play } from "lucide-react";
import { Section, Reveal, Eyebrow } from "./Section";
import heroBgMp4 from "@/assets/archer/hero-bg.mp4";
import heroBgWebm from "@/assets/archer/hero-bg.webm";
import heroPoster from "@/assets/archer/hero-bg-poster.jpg";
import archerVideo from "@/assets/archer/archer-marketing-agent.mp4.asset.json";

export function VideoSection() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      v.load();
      v.play().catch(() => {});
    }, 50);
  };

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
          <div className="overflow-hidden rounded-2xl border border-border bg-neutral-900 shadow-2xl shadow-primary/20">
            <div className="flex items-center gap-2 border-b border-white/10 bg-neutral-950 px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f56]" />
              <span className="size-3 rounded-full bg-[#ffbd2e]" />
              <span className="size-3 rounded-full bg-[#27c93f]" />
              <span className="ml-3 truncate font-mono text-xs text-white/40">archer.app</span>
            </div>
            <div className="relative aspect-video w-full bg-black">
              {!playing ? (
                <>
                  {/* Background pre-roll loop as poster */}
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster={heroPoster}
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                  >
                    <source src={heroBgWebm} type="video/webm" />
                    <source src={heroBgMp4} type="video/mp4" />
                  </video>
                  {/* Play button overlay */}
                  <button
                    type="button"
                    onClick={handlePlay}
                    aria-label="Play Archer explainer video"
                    className="group absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/50"
                  >
                    <span className="flex size-20 items-center justify-center rounded-full bg-white/95 shadow-2xl shadow-black/40 transition group-hover:scale-110 md:size-24">
                      <Play className="ml-1 size-10 fill-[#001f5b] text-[#001f5b] md:size-12" />
                    </span>
                  </button>
                </>
              ) : (
                <video
                  key={archerVideo.asset_id}
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  src={archerVideo.url}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
