import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Target, Zap } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const features = [
    {
      icon: Target,
      title: 'AI-Powered Insights',
      description: 'Analyze your target audience with precision',
    },
    {
      icon: Sparkles,
      title: 'Auto-Generated Content',
      description: 'Beautiful images, videos, and copy in seconds',
    },
    {
      icon: Zap,
      title: 'One-Click Scheduling',
      description: 'Post across all platforms effortlessly',
    },
  ];

  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          AI-Powered Marketing
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
          Grow Your Practice with{' '}
          <span className="text-gradient">Intelligent Marketing</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Let AI analyze your brand, understand your patients, and create campaigns
          that convert—all in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 w-full">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all duration-300 hover:shadow-lg"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 mx-auto">
              <feature.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <Button variant="hero" size="xl" onClick={onNext} className="group">
        Get Started
        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
      </Button>

      <p className="mt-4 text-sm text-muted-foreground">
        No credit card required • Free preview included
      </p>
    </div>
  );
};
