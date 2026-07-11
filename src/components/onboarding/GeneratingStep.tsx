import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Search, Palette, FileText, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GeneratingStepProps {
  onComplete: () => void;
  onError: (msg: string) => void;
  practiceName: string;
  prospectId?: string;
}

const phases: Array<{ status: string; label: string; icon: React.ComponentType<any> }> = [
  { status: 'pending', label: 'Preparing your workspace...', icon: Sparkles },
  { status: 'scraping', label: 'Analyzing your website...', icon: Search },
  { status: 'generating_reports', label: 'Building practice, competitive, audience & brand reports...', icon: FileText },
  { status: 'generating_content', label: 'Writing your blog article and social posts...', icon: Palette },
  { status: 'ready', label: 'Almost there, assembling your email funnel...', icon: Mail },
];

export const GeneratingStep: React.FC<GeneratingStepProps> = ({ onComplete, onError, practiceName, prospectId }) => {
  const [status, setStatus] = useState<string>('pending');
  const doneRef = useRef(false);

  useEffect(() => {
    if (!prospectId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-started-status', {
          body: { prospectId },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        const s = (data as any)?.status as string;
        const err = (data as any)?.error as string | null;
        if (s) setStatus(s);
        if (s === 'ready' && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => !cancelled && onComplete(), 400);
          return;
        }
        if (s === 'failed') {
          doneRef.current = true;
          onError(err || 'Generation failed');
          return;
        }
      } catch (e: any) {
        // Transient network hiccups, keep polling.
        console.warn('[GeneratingStep] poll error', e);
      }
      if (!cancelled && !doneRef.current) setTimeout(poll, 3000);
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, [prospectId, onComplete, onError]);

  const activeIndex = Math.max(0, phases.findIndex((p) => p.status === status));
  const progress = ((activeIndex + 1) / phases.length) * 100;
  const CurrentIcon = phases[activeIndex]?.icon || Sparkles;

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto animate-fade-in">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center animate-pulse-glow">
          <CurrentIcon className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-primary/20 animate-ping" />
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Creating Your Campaign</h2>
      <p className="text-muted-foreground mb-8">
        AI is analyzing <span className="font-medium text-foreground">{practiceName}</span> and crafting
        personalized content, this usually takes 60–120 seconds.
      </p>

      <div className="w-full space-y-4">
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-gradient rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {phases.map((phase, index) => {
            const StepIcon = phase.icon;
            const isComplete = index < activeIndex;
            const isActive = index === activeIndex;
            return (
              <div
                key={phase.status}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive ? 'bg-accent' : isComplete ? 'opacity-60' : 'opacity-30'
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <StepIcon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
                <span
                  className={`text-sm text-left ${
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {phase.label}
                </span>
                {isComplete && <span className="ml-auto text-xs text-primary font-medium">Done</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
