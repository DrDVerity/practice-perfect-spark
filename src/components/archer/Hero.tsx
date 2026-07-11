import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "./Section";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import heroImg from "@/assets/archer/hero.jpg";
import heroMobileImg from "@/assets/archer/hero-mobile.jpg";
import heroBgMp4 from "@/assets/archer/hero-bg.mp4";
import heroBgWebm from "@/assets/archer/hero-bg.webm";
import heroPoster from "@/assets/archer/hero-bg-poster.jpg";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-6 pb-0 pt-32 md:pt-44 min-h-[100svh] md:min-h-0">
      <div
        className="absolute inset-0 -z-20 bg-no-repeat bg-top [background-size:100%_auto] md:hidden"
        style={{ backgroundImage: `url(${heroMobileImg})` }}
        aria-hidden="true"
      />
      <video
        className="absolute inset-0 -z-20 hidden h-full w-full object-cover md:block"
        autoPlay
        muted
        loop
        playsInline
        poster={heroPoster}
        aria-hidden="true"
      >
        <source src={heroBgWebm} type="video/webm" />
        <source src={heroBgMp4} type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/55 dark:from-[#001028]/55 dark:via-[#000814]/50 dark:to-[#000814]/70" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 mesh-bg opacity-30" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-accent/10 via-transparent to-transparent" />


      <div className="relative mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="-mt-12 md:-mt-16"
        >
          <Eyebrow>AI Marketing Director · Built for Dental Practices</Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-28 text-3xl font-bold tracking-tight md:text-4xl [text-shadow:0_2px_20px_rgba(0,8,20,0.65)]"
        >
          <span className="block whitespace-nowrap text-white">Dental practice marketing, made easy!</span>
          <span className="block text-[#FFD700]">Get results Automatically.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-lg md:text-lg text-slate-50 font-light [text-shadow:0_1px_12px_rgba(0,8,20,0.6)]"
        >
          Archer reads your website, your reviews, and your goals, then builds, designs, and runs your
          campaigns across every channel. Twenty minutes a week instead of ten hours, or $5,000 a month
          for an agency.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" className="h-12 px-6 text-base shadow-xl shadow-primary/25 bg-[#001f5b] text-white hover:bg-[#001f5b]/90" asChild>
            <Link to="/get-started">
              Build a Free Campaign <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </motion.div>


      </div>

      <div className="relative mt-16 -mx-6 bg-[#001f5b] px-6 py-10 md:py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-base text-white md:text-lg"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> Free preview · no card required
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" /> HIPAA Compliant · No PHI in campaigns
          </span>
          <span>Trusted by independent practices across the US</span>
        </motion.div>
      </div>
    </section>

  );
}
