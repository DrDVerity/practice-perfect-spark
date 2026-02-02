import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignCard } from './CampaignCard';
import { LoginWall } from './LoginWall';
import { Campaign, PracticeData } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useProfile } from '@/hooks/useProfile';

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
  const navigate = useNavigate();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'download' | 'edit' | 'schedule'; campaignId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user, signInWithGoogle, isLoading: authLoading } = useAuth();
  const { saveCampaign } = useCampaigns();
  const { updateProfile } = useProfile();

  const handleProtectedAction = (type: 'download' | 'edit' | 'schedule', campaignId: string) => {
    if (!user) {
      setPendingAction({ type, campaignId });
      setShowLoginWall(true);
      return;
    }
    
    executeAction(type, campaignId);
  };

  const executeAction = (type: 'download' | 'edit' | 'schedule', campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    switch (type) {
      case 'download':
        if (campaign.imageUrl) {
          const link = document.createElement('a');
          link.href = campaign.imageUrl;
          link.download = `${campaign.title.replace(/\s+/g, '-')}.jpg`;
          link.click();
          toast.success('Download started!');
        }
        break;
      case 'edit':
        navigate(`/campaign/edit/${campaignId}`);
        break;
      case 'schedule':
        navigate('/schedule');
        break;
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  // After successful login, save campaigns and update profile
  React.useEffect(() => {
    const saveCampaignsAfterLogin = async () => {
      if (user && pendingAction) {
        setIsSaving(true);
        
        try {
          // Update profile with practice data
          await updateProfile.mutateAsync({
            practice_name: practiceData.practiceName,
            website_url: practiceData.websiteUrl,
            target_audience: practiceData.targetAudience,
            campaign_focus: practiceData.campaignFocus,
          });

          // Save all campaigns to the vault
          for (const campaign of campaigns) {
            await saveCampaign.mutateAsync({
              title: campaign.title,
              description: campaign.description,
              image_url: campaign.imageUrl,
              video_url: campaign.videoUrl || null,
              text_copy: campaign.textCopy,
              platform: campaign.platform,
              status: 'draft',
              scheduled_date: null,
              target_audience: practiceData.targetAudience,
            });
          }

          toast.success('Campaigns saved to your account!');
          
          // Execute pending action
          executeAction(pendingAction.type, pendingAction.campaignId);
        } catch (error) {
          console.error('Error saving data:', error);
          toast.error('Failed to save campaigns. Please try again.');
        } finally {
          setIsSaving(false);
          setPendingAction(null);
          setShowLoginWall(false);
        }
      }
    };

    saveCampaignsAfterLogin();
  }, [user]);

  const isLoggedIn = !!user;

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
        <div className="flex items-center gap-4">
          {isLoggedIn && (
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {campaigns.length} Campaigns Generated
            </span>
          </div>
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
            onDownload={() => handleProtectedAction('download', campaign.id)}
            onEdit={() => handleProtectedAction('edit', campaign.id)}
            onClick={() => handleProtectedAction('edit', campaign.id)}
            isLocked={!isLoggedIn}
          />
        ))}
      </div>

      {/* Saving Overlay */}
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Saving your campaigns...</h3>
            <p className="text-muted-foreground">This will only take a moment.</p>
          </div>
        </div>
      )}

      {/* Login Wall Modal */}
      {showLoginWall && !isSaving && (
        <LoginWall
          onGoogleLogin={handleGoogleLogin}
          onClose={() => {
            setShowLoginWall(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
};
