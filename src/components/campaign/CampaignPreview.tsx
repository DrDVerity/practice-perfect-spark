import React, { useState } from 'react';
import { CampaignCard } from './CampaignCard';
import { LoginWall } from './LoginWall';
import { Campaign, PracticeData } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CampaignPreviewProps {
  campaigns: Campaign[];
  practiceData: PracticeData;
  onBack: () => void;
}

export const CampaignPreview: React.FC<CampaignPreviewProps> = ({
  campaigns,
  practiceData,
  onBack,
}) => {
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleProtectedAction = () => {
    if (!isLoggedIn) {
      setShowLoginWall(true);
    }
  };

  const handleGoogleLogin = () => {
    // Simulate login - in production this would use real OAuth
    toast.success('Successfully signed in!', {
      description: 'Your campaigns have been saved to your account.',
    });
    setIsLoggedIn(true);
    setShowLoginWall(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Start Over
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Your Campaign Preview
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-generated campaigns for <span className="font-medium text-foreground">{practiceData.practiceName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {campaigns.length} Campaigns Generated
          </span>
        </div>
      </div>

      {/* Gap Analysis Summary */}
      <div className="mb-8 p-6 rounded-2xl bg-card border border-border">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Insights for {practiceData.targetAudience}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-accent/50">
            <h3 className="text-sm font-medium text-primary mb-2">Top Patient Concerns</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Fear of dental procedures</li>
              <li>• Cost transparency</li>
              <li>• Scheduling flexibility</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-accent/50">
            <h3 className="text-sm font-medium text-primary mb-2">Key Desires</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Gentle, patient care</li>
              <li>• Modern technology</li>
              <li>• Quick appointments</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-accent/50">
            <h3 className="text-sm font-medium text-primary mb-2">Campaign Opportunities</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Highlight sedation options</li>
              <li>• Showcase payment plans</li>
              <li>• Promote same-day care</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Campaign Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onDownload={handleProtectedAction}
            onEdit={handleProtectedAction}
            onSchedule={handleProtectedAction}
            isLocked={!isLoggedIn}
          />
        ))}
      </div>

      {/* Login Wall Modal */}
      {showLoginWall && (
        <LoginWall
          onGoogleLogin={handleGoogleLogin}
          onClose={() => setShowLoginWall(false)}
        />
      )}
    </div>
  );
};
