import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Target, Zap, CheckCircle2 } from 'lucide-react';
import archerHero from '@/assets/archer-hero.jpg';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const pillars = [
    {
      icon: Target,
      title: 'Learns Your Practice',
      description: 'Scrapes your site, reviews, and brand voice in minutes.',
    },
    {
      icon: Sparkles,
      title: 'Builds Full Campaigns',
      description: 'Strategy, copy, images, landing pages — done for you.',
    },
    {
      icon: Zap,
      title: 'Posts on Auto-Pilot',
      description: 'Schedules across every channel. You stay in the chair.',
    },
  ];

  const proofPoints = [
    'Replace a $5K/month agency',
    'Launch campaigns in minutes, not weeks',
    'New patients land in your dashboard',
  ];

  return (
    <section className="relative w-full animate-fade-in">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
        {/* Left: Copy */}
        <div className="flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Meet Archer — AI Marketing Director for Dentists
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-[1.05] tracking-tight">
            Your practice's{' '}
            <span className="text-gradient">marketing department</span>,
            running itself.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed">
            Archer learns your practice, builds full campaigns, designs the
            creative, and posts everywhere on schedule — so you spend 20
            minutes reviewing results instead of 10 hours making them.
          </p>

          <ul className="space-y-3 mb-10">
            {proofPoints.map((point) => (
              <li key={point} className="flex items-center gap-3 text-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-medium">{point}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="hero" size="xl" onClick={onNext} className="group">
              See Archer Build a Campaign
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card • Free preview generated for your practice
          </p>
        </div>

        {/* Right: Hero image */}
        <div className="relative">
          <div className="absolute -inset-4 bg-brand-gradient opacity-20 blur-3xl rounded-3xl" aria-hidden="true" />
          <div className="relative rounded-3xl overflow-hidden border border-border/50 shadow-2xl bg-card">
            <img
              src={archerHero}
              alt="Dentist reviewing an Archer AI marketing dashboard with campaign analytics and scheduled social posts"
              width={1536}
              height={1024}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>

      {/* Pillars */}
      <div className="mt-20 md:mt-28 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            One platform. Three superpowers.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everything an agency does for $5,000 a month — built into a single
            workflow that runs while you practice.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pillars.map((feature, index) => (
            <div
              key={feature.title}
              className="p-7 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 text-lg">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
