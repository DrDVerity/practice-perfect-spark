import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/icons/Logo';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { BasicInfoStep } from '@/components/onboarding/BasicInfoStep';
import { CampaignDetailsStep } from '@/components/onboarding/CampaignDetailsStep';
import { GeneratingStep } from '@/components/onboarding/GeneratingStep';
import { CampaignPreview } from '@/components/campaign/CampaignPreview';
import { PracticeData, OnboardingStep } from '@/types/campaign';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const steps = [
  { id: 'basic-info', label: 'Your Info' },
  { id: 'campaign-details', label: 'Campaign' },
  { id: 'preview', label: 'Preview' },
];

const emptyPractice: PracticeData = {
  practiceName: '',
  email: '',
  targetAudience: [],
  websiteUrl: '',
  campaignFocus: '',
  landingPageUrl: '',
  createLandingPage: true,
  repositoryDocs: [],
  addNewRepository: false,
  createNewRepository: false,
};

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basic-info');

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard');
  }, [user, authLoading, navigate]);

  const [practiceData, setPracticeData] = useState<PracticeData>(emptyPractice);

  const getStepIndex = () => {
    switch (currentStep) {
      case 'welcome': return -1;
      case 'basic-info': return 0;
      case 'campaign-details': return 1;
      case 'generating':
      case 'preview': return 2;
      default: return 0;
    }
  };

  const kickoffGeneration = useCallback(async () => {
    setCurrentStep('generating');
    try {
      const { data, error } = await supabase.functions.invoke('get-started-generate', {
        body: {
          email: practiceData.email,
          practiceName: practiceData.practiceName,
          websiteUrl: practiceData.websiteUrl,
          campaignFocus: practiceData.campaignFocus,
          targetAudience: practiceData.targetAudience,
        },
      });
      if (error) throw new Error(error.message);
      const pid = (data as any)?.prospectId;
      if (!pid) throw new Error('No prospectId returned');
      setPracticeData((prev) => ({ ...prev, prospectId: pid }));
      try { sessionStorage.setItem('prospectId', pid); } catch {}
    } catch (err: any) {
      toast.error('Could not start generation', { description: err.message });
      setCurrentStep('campaign-details');
    }
  }, [practiceData]);

  const handleGenerationComplete = useCallback(() => {
    setCurrentStep('preview');
  }, []);

  const handleGenerationError = useCallback((msg: string) => {
    toast.error('Generation failed', { description: msg });
    setCurrentStep('campaign-details');
  }, []);

  const handleStartOver = () => {
    setPracticeData(emptyPractice);
    setCurrentStep('basic-info');
    try { sessionStorage.removeItem('prospectId'); } catch {}
  };

  const isPreview = currentStep === 'preview';
  return (
    <div className={`min-h-screen bg-hero-gradient ${isPreview ? 'dark bg-background text-foreground' : ''}`}>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/" aria-label="Return to Archer home"><Logo /></Link>
          {currentStep !== 'welcome' && currentStep !== 'generating' && currentStep !== 'preview' && (
            <StepIndicator steps={steps} currentStep={getStepIndex()} />
          )}
          <div className="flex items-center gap-2">
            {authLoading ? (
              <div className="w-[100px]" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="gap-2">
                <LogIn className="w-4 h-4" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 md:py-16">
        {currentStep === 'welcome' && <WelcomeStep onNext={() => setCurrentStep('basic-info')} />}

        {currentStep === 'basic-info' && (
          <BasicInfoStep
            data={{ practiceName: practiceData.practiceName, email: practiceData.email }}
            onUpdate={(data) => setPracticeData({ ...practiceData, ...data })}
            onNext={() => setCurrentStep('campaign-details')}
            onBack={() => navigate('/')}
          />
        )}

        {currentStep === 'campaign-details' && (
          <CampaignDetailsStep
            data={{
              targetAudience: practiceData.targetAudience,
              websiteUrl: practiceData.websiteUrl,
              campaignFocus: practiceData.campaignFocus,
              landingPageUrl: practiceData.landingPageUrl,
              createLandingPage: practiceData.createLandingPage,
              repositoryDocs: practiceData.repositoryDocs,
              addNewRepository: practiceData.addNewRepository,
              createNewRepository: practiceData.createNewRepository,
            }}
            onUpdate={(data) => setPracticeData({ ...practiceData, ...data })}
            onNext={kickoffGeneration}
            onBack={() => setCurrentStep('basic-info')}
          />
        )}

        {currentStep === 'generating' && (
          <GeneratingStep
            practiceName={practiceData.practiceName}
            prospectId={practiceData.prospectId}
            onComplete={handleGenerationComplete}
            onError={handleGenerationError}
          />
        )}

        {currentStep === 'preview' && (
          <CampaignPreview
            practiceData={practiceData}
            onBack={handleStartOver}
          />
        )}
      </main>

      <footer className="border-t border-border/50 py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Archer. Powered by AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
