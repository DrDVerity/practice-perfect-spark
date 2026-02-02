import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Image, Video, Save, ExternalLink, Sparkles, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns, CampaignVault } from '@/hooks/useCampaigns';
import { toast } from 'sonner';

const CampaignEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { campaigns, updateCampaign, isLoading: campaignsLoading } = useCampaigns();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    text_copy: '',
    platform: 'instagram' as 'instagram' | 'facebook' | 'linkedin' | 'twitter',
    image_url: '',
    video_url: '',
    target_audience: '',
  });

  const campaign = campaigns.find(c => c.id === id);

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title || '',
        description: campaign.description || '',
        text_copy: campaign.text_copy || '',
        platform: campaign.platform,
        image_url: campaign.image_url || '',
        video_url: campaign.video_url || '',
        target_audience: campaign.target_audience || '',
      });
    }
  }, [campaign]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSave = () => {
    if (!id) return;
    
    updateCampaign.mutate({
      id,
      ...formData,
    });
  };

  const openImagenEditor = () => {
    // Open Google's Imagen Editor - in production this would link to the actual editor
    window.open('https://labs.google/', '_blank');
    toast.info('Opening Imagen Editor...', {
      description: 'Edit your campaign image with AI-powered tools.',
    });
  };

  const openGoogleVids = () => {
    // Open Google Vids Workspace - in production this would link to the actual editor
    window.open('https://workspace.google.com/products/vids/', '_blank');
    toast.info('Opening Google Vids Workspace...', {
      description: 'Edit your campaign video with professional tools.',
    });
  };

  if (authLoading || campaignsLoading) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Campaign Not Found</h1>
          <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <Logo />
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-16 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Edit Campaign
          </h1>
          <p className="text-muted-foreground">
            Modify your campaign content and assets
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Campaign Details
              </h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Campaign Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter campaign title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your campaign"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="text_copy">Post Copy</Label>
                  <Textarea
                    id="text_copy"
                    value={formData.text_copy}
                    onChange={(e) => setFormData({ ...formData, text_copy: e.target.value })}
                    placeholder="Write your social media post content"
                    rows={5}
                  />
                </div>

                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value: 'instagram' | 'facebook' | 'linkedin' | 'twitter') =>
                      setFormData({ ...formData, platform: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="target_audience">Target Audience</Label>
                  <Input
                    id="target_audience"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    placeholder="e.g., Families, Young Professionals"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={updateCampaign.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateCampaign.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => navigate('/schedule')}
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Posting Schedule
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Asset Editors */}
          <div className="space-y-6">
            {/* Image Editor */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Image className="w-5 h-5 text-primary" />
                Image Asset
              </h2>
              
              {formData.image_url && (
                <div className="mb-4 rounded-xl overflow-hidden bg-muted aspect-video">
                  <img
                    src={formData.image_url}
                    alt="Campaign preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="Enter image URL"
                  />
                </div>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={openImagenEditor}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Imagen Editor
                </Button>
              </div>
            </div>

            {/* Video Editor */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Video Asset
              </h2>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="video_url">Video URL</Label>
                  <Input
                    id="video_url"
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    placeholder="Enter video URL"
                  />
                </div>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={openGoogleVids}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Google Vids Workspace
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CampaignEdit;
