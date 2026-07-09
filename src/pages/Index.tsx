import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { BasicInfoStep } from '@/components/onboarding/BasicInfoStep';
import { CampaignDetailsStep } from '@/components/onboarding/CampaignDetailsStep';
import { GeneratingStep } from '@/components/onboarding/GeneratingStep';
import { CampaignPreview } from '@/components/campaign/CampaignPreview';
import { PracticeData, Campaign, OnboardingStep } from '@/types/campaign';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import campaignFamily from '@/assets/campaign-family.jpg';
import campaignWhitening from '@/assets/campaign-whitening.jpg';
import campaignEmergency from '@/assets/campaign-emergency.jpg';


const steps = [
  { id: 'basic-info', label: 'Your Info' },
  { id: 'campaign-details', label: 'Campaign' },
  { id: 'preview', label: 'Preview' },
];

const FALLBACK_IMAGES = [campaignFamily, campaignWhitening, campaignEmergency];

async function generateRealSampleCampaigns(practiceData: PracticeData): Promise<Campaign[]> {
  const { data, error } = await supabase.functions.invoke('generate-sample-campaign', {
    body: {
      practiceName: practiceData.practiceName,
      websiteUrl: practiceData.websiteUrl,
      campaignFocus: practiceData.campaignFocus,
      targetAudience: practiceData.targetAudience,
    },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  const posts = (data as any)?.posts as Array<any> | undefined;
  if (!posts?.length) throw new Error('No sample posts returned');
  return posts.map((p, i) => ({
    id: p.id || String(i + 1),
    title: p.title,
    description: p.description,
    imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
    textCopy: p.textCopy,
    platform: p.platform,
    status: 'draft' as const,
  }));
}


const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basic-info');

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);
  const [practiceData, setPracticeData] = useState<PracticeData>({
    practiceName: '',
    email: '',
    targetAudience: '',
    websiteUrl: '',
    campaignFocus: '',
    landingPageUrl: '',
    createLandingPage: true,
    repositoryDocs: [],
    addNewRepository: false,
    createNewRepository: false,
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const getStepIndex = () => {
    switch (currentStep) {
      case 'welcome':
        return -1;
      case 'basic-info':
        return 0;
      case 'campaign-details':
        return 1;
      case 'generating':
        return 2;
      case 'preview':
        return 2;
      default:
        return 0;
    }
  };

  const handleGenerationComplete = useCallback(async () => {
    try {
      const generatedCampaigns = await generateRealSampleCampaigns(practiceData);
      setCampaigns(generatedCampaigns);
      setCurrentStep('preview');
    } catch (err: any) {
      toast.error('Could not generate sample campaigns', { description: err.message });
      setCurrentStep('campaign-details');
    }
  }, [practiceData]);


  const handleStartOver = () => {
    setPracticeData({
      practiceName: '',
      email: '',
      targetAudience: '',
      websiteUrl: '',
      campaignFocus: '',
      landingPageUrl: '',
      createLandingPage: true,
      repositoryDocs: [],
      addNewRepository: false,
      createNewRepository: false,
    });
    setCampaigns([]);
    setCurrentStep('basic-info');
  };

  return (
    <div className="min-h-screen bg-hero-gradient">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <Logo />
          {currentStep !== 'welcome' && currentStep !== 'generating' && currentStep !== 'preview' && (
            <StepIndicator steps={steps} currentStep={getStepIndex()} />
          )}
          <div className="flex items-center gap-2">
            {authLoading ? (
              <div className="w-[100px]" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
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

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-16">
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={() => setCurrentStep('basic-info')} />
        )}

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
            onNext={() => setCurrentStep('generating')}
            onBack={() => setCurrentStep('basic-info')}
          />
        )}

        {currentStep === 'generating' && (
          <GeneratingStep
            onComplete={handleGenerationComplete}
            practiceData={practiceData}
          />
        )}

        {currentStep === 'preview' && (
          <CampaignPreview
            campaigns={campaigns}
            practiceData={practiceData}
            onBack={handleStartOver}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Synergy Dental Marketing. Powered by AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
