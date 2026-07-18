import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, Building2, Mail } from 'lucide-react';

interface BasicInfoStepProps {
  data: { practiceName: string; email: string };
  onUpdate: (data: { practiceName: string; email: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<{ practiceName?: string; email?: string }>({});

  const validateAndNext = () => {
    const newErrors: { practiceName?: string; email?: string } = {};

    if (!data.practiceName.trim()) {
      newErrors.practiceName = 'Practice name is required';
    }

    if (!data.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Tell Us About Your Practice
        </h2>
        <p className="text-muted-foreground">
          We'll use this to personalize your marketing campaigns
        </p>
      </div>

      <div className="space-y-6 bg-card p-8 rounded-2xl border border-border shadow-lg">
        <div className="space-y-2">
          <Label htmlFor="practiceName" className="text-foreground font-medium">
            Practice Name
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="practiceName"
              type="text"
              placeholder="Smile Dental Clinic"
              value={data.practiceName}
              onChange={(e) => onUpdate({ ...data, practiceName: e.target.value })}
              className={`pl-10 h-12 ${errors.practiceName ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.practiceName && (
            <p className="text-sm text-destructive">{errors.practiceName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">
            Your Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@practice.com"
              value={data.email}
              onChange={(e) => onUpdate({ ...data, email: e.target.value })}
              className={`pl-10 h-12 ${errors.email ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={validateAndNext}
            className="flex-1 group bg-[hsl(220,100%,18%)] text-white hover:bg-[hsl(220,100%,14%)] border-transparent"
          >
            Continue
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
