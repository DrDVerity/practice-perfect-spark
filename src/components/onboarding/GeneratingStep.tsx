import React, { useEffect, useState } from 'react';
import { Sparkles, Search, Palette, Video, Image, FileText } from 'lucide-react';

interface GeneratingStepProps {
  onComplete: () => void;
  practiceData: {
    practiceName: string;
    targetAudience: string;
    websiteUrl: string;
    campaignFocus: string;
  };
}

const generationSteps = [
  { icon: Palette, label: 'Extracting brand DNA from website...', duration: 1500 },
  { icon: Search, label: 'Researching audience insights...', duration: 2000 },
  { icon: FileText, label: 'Crafting campaign concepts...', duration: 1800 },
  { icon: Image, label: 'Generating campaign images...', duration: 2200 },
  { icon: Video, label: 'Creating video drafts...', duration: 2500 },
  { icon: Sparkles, label: 'Finalizing your campaigns...', duration: 1000 },
];

export const GeneratingStep: React.FC<GeneratingStepProps> = ({ onComplete, practiceData }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let totalTime = 0;
    const timers: NodeJS.Timeout[] = [];

    generationSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        setCurrentStep(index);
        setProgress(((index + 1) / generationSteps.length) * 100);
      }, totalTime);
      timers.push(timer);
      totalTime += step.duration;
    });

    const completeTimer = setTimeout(() => {
      onComplete();
    }, totalTime + 500);
    timers.push(completeTimer);

    return () => timers.forEach((t) => clearTimeout(t));
  }, [onComplete]);

  const CurrentIcon = generationSteps[currentStep]?.icon || Sparkles;

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto animate-fade-in">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center animate-pulse-glow">
          <CurrentIcon className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-primary/20 animate-ping" />
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
        Creating Your Campaigns
      </h2>
      <p className="text-muted-foreground mb-8">
        AI is analyzing <span className="font-medium text-foreground">{practiceData.practiceName}</span> and
        crafting personalized content
      </p>

      <div className="w-full space-y-4">
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-gradient rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {generationSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isComplete = index < currentStep;
            const isActive = index === currentStep;

            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-accent'
                    : isComplete
                    ? 'opacity-50'
                    : 'opacity-30'
                }`}
              >
                <StepIcon
                  className={`w-5 h-5 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-sm ${
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
                {isComplete && (
                  <span className="ml-auto text-xs text-primary font-medium">Done</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
