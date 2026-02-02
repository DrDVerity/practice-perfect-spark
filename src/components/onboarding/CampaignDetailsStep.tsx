import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, ArrowLeft, Globe, Users, Lightbulb } from 'lucide-react';

interface CampaignDetailsStepProps {
  data: { targetAudience: string; websiteUrl: string; campaignFocus: string };
  onUpdate: (data: { targetAudience: string; websiteUrl: string; campaignFocus: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

const audienceSuggestions = [
  'Families with children',
  'Young professionals',
  'Seniors 55+',
  'Patients needing cosmetic work',
  'Emergency dental patients',
];

export const CampaignDetailsStep: React.FC<CampaignDetailsStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<{ targetAudience?: string; websiteUrl?: string; campaignFocus?: string }>({});

  const validateAndNext = () => {
    const newErrors: { targetAudience?: string; websiteUrl?: string; campaignFocus?: string } = {};

    if (!data.targetAudience.trim()) {
      newErrors.targetAudience = 'Target audience is required';
    }

    if (!data.websiteUrl.trim()) {
      newErrors.websiteUrl = 'Website URL is required';
    } else if (!/^https?:\/\/.+\..+/.test(data.websiteUrl)) {
      newErrors.websiteUrl = 'Please enter a valid URL (e.g., https://example.com)';
    }

    if (!data.campaignFocus.trim()) {
      newErrors.campaignFocus = 'Campaign focus is required';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Define Your Campaign
        </h2>
        <p className="text-muted-foreground">
          Help us understand who you want to reach and what you want to promote
        </p>
      </div>

      <div className="space-y-6 bg-card p-8 rounded-2xl border border-border shadow-lg">
        <div className="space-y-2">
          <Label htmlFor="targetAudience" className="text-foreground font-medium">
            Target Audience
          </Label>
          <div className="relative">
            <Users className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <Input
              id="targetAudience"
              type="text"
              placeholder="e.g., Families with young children"
              value={data.targetAudience}
              onChange={(e) => onUpdate({ ...data, targetAudience: e.target.value })}
              className={`pl-10 h-12 ${errors.targetAudience ? 'border-destructive' : ''}`}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {audienceSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onUpdate({ ...data, targetAudience: suggestion })}
                className="px-3 py-1 text-xs rounded-full bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
          {errors.targetAudience && (
            <p className="text-sm text-destructive">{errors.targetAudience}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl" className="text-foreground font-medium">
            Practice Website URL
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://www.yourpractice.com"
              value={data.websiteUrl}
              onChange={(e) => onUpdate({ ...data, websiteUrl: e.target.value })}
              className={`pl-10 h-12 ${errors.websiteUrl ? 'border-destructive' : ''}`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We'll analyze your website to match your brand style
          </p>
          {errors.websiteUrl && (
            <p className="text-sm text-destructive">{errors.websiteUrl}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaignFocus" className="text-foreground font-medium">
            Campaign Focus Idea
          </Label>
          <div className="relative">
            <Lightbulb className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <Textarea
              id="campaignFocus"
              placeholder="e.g., Promote our new teeth whitening service with a spring discount..."
              value={data.campaignFocus}
              onChange={(e) => onUpdate({ ...data, campaignFocus: e.target.value })}
              className={`pl-10 min-h-[100px] resize-none ${errors.campaignFocus ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.campaignFocus && (
            <p className="text-sm text-destructive">{errors.campaignFocus}</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button variant="hero" size="lg" onClick={validateAndNext} className="flex-1 group">
            Generate Campaigns
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
