import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";
import { Section, Reveal, Eyebrow } from "./Section";
import videoThumb from "@/assets/archer/video-thumbnail.png";
import explainerVideo from "@/assets/archer/archer-explainer.mp4.asset.json";

export function VideoSection() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setPlaying(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  };

  return (
    <Section id="video" className="pt-0 md:pt-0 bg-[#001f5b] text-white">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow><span className="text-[#FFD700]">See Archer in 45 seconds</span></Eyebrow>
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
            </div>
            <div className="relative aspect-video w-full bg-black">
              {!playing ? (
                <button
                  type="button"
                  onClick={handlePlay}
                  aria-label="Play explainer video"
                  className="group relative block h-full w-full"
                >
                  <img
                    src={videoThumb}
                    alt="Archer explainer video thumbnail"
                    loading="lazy"
                    width={1920}
                    height={1080}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0.9 }}
                    whileHover={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="flex items-center gap-3 rounded-full bg-white/95 px-7 py-4 text-base font-semibold text-neutral-900 shadow-xl backdrop-blur transition-transform group-hover:scale-105">
                      <PlayCircle className="size-7 text-[#FFD700]" />
                      Play
                    </span>
                  </motion.div>
                </button>
              ) : (
                <video
                  ref={videoRef}
                  src={explainerVideo.url}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
