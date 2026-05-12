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
import { LogIn, LogOut, User } from 'lucide-react';
import campaignFamily from '@/assets/campaign-family.jpg';
import campaignWhitening from '@/assets/campaign-whitening.jpg';
import campaignEmergency from '@/assets/campaign-emergency.jpg';

const steps = [
  { id: 'basic-info', label: 'Your Info' },
  { id: 'campaign-details', label: 'Campaign' },
  { id: 'preview', label: 'Preview' },
];

const generateMockCampaigns = (practiceData: PracticeData): Campaign[] => [
  {
    id: '1',
    title: 'Family Dental Care Excellence',
    description: `Perfect for ${practiceData.targetAudience}. Showcase your practice's commitment to comprehensive family dentistry.`,
    imageUrl: campaignFamily,
    videoUrl: '#',
    textCopy: `At ${practiceData.practiceName}, we believe every smile tells a story. 🦷✨ Our expert team is dedicated to providing gentle, personalized care for the whole family. Book your visit today and experience the difference! #FamilyDentistry #HealthySmiles`,
    platform: 'instagram',
    status: 'draft',
  },
  {
    id: '2',
    title: 'Brighten Your Smile Campaign',
    description: 'Promote your teeth whitening services with this engaging campaign designed to attract cosmetic-focused patients.',
    imageUrl: campaignWhitening,
    textCopy: `Ready for a brighter, more confident smile? ☀️ ${practiceData.practiceName} offers professional teeth whitening that delivers stunning results in just one visit. Limited time offer: 20% off all whitening treatments! DM us to book. #TeethWhitening #ConfidentSmile`,
    platform: 'facebook',
    status: 'draft',
  },
  {
    id: '3',
    title: 'Emergency Care Awareness',
    description: 'Build trust by highlighting your availability for dental emergencies and compassionate urgent care.',
    imageUrl: campaignEmergency,
    textCopy: `Dental emergency? We're here for you. 🏥 ${practiceData.practiceName} offers same-day emergency appointments because we know dental pain can't wait. Our caring team is ready to help you feel better fast. Call us now or walk in today. #EmergencyDentist #DentalCare`,
    platform: 'linkedin',
    status: 'draft',
  },
];

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

  const handleGenerationComplete = useCallback(() => {
    const generatedCampaigns = generateMockCampaigns(practiceData);
    setCampaigns(generatedCampaigns);
    setCurrentStep('preview');
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
    setCurrentStep('welcome');
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
            onBack={() => setCurrentStep('welcome')}
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
