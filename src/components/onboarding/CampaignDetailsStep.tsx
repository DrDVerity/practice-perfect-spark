import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, Globe, Users, Lightbulb, Link2, FolderOpen, Plus, FileText, Eye } from 'lucide-react';
import { RepositoryDocument } from '@/types/campaign';

interface CampaignDetailsStepProps {
  data: {
    targetAudience: string;
    websiteUrl: string;
    campaignFocus: string;
    landingPageUrl: string;
    createLandingPage: boolean;
    repositoryDocs: RepositoryDocument[];
    addNewRepository: boolean;
    createNewRepository: boolean;
  };
  onUpdate: (data: {
    targetAudience: string;
    websiteUrl: string;
    campaignFocus: string;
    landingPageUrl: string;
    createLandingPage: boolean;
    repositoryDocs: RepositoryDocument[];
    addNewRepository: boolean;
    createNewRepository: boolean;
  }) => void;
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

  // Auto-check createLandingPage when landingPageUrl is empty
  useEffect(() => {
    if (!data.landingPageUrl.trim() && !data.createLandingPage) {
      onUpdate({ ...data, createLandingPage: true });
    }
  }, [data.landingPageUrl]);

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

  const handleLandingPageChange = (url: string) => {
    onUpdate({
      ...data,
      landingPageUrl: url,
      // Auto-check createLandingPage if URL is cleared
      createLandingPage: url.trim() === '' ? true : data.createLandingPage,
    });
  };

  const handleAddDocuments = () => {
    // Placeholder: Will implement document upload dialog
    console.log('Add documents clicked');
  };

  const handleViewEditRepository = () => {
    // Placeholder: Will navigate to repository view/edit
    console.log('View/Edit repository clicked');
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
        {/* Target Audience */}
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

        {/* Practice Website URL */}
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

        {/* Campaign Focus Idea */}
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

        {/* New Campaign Section */}
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            New Campaign
          </h3>

          {/* Landing Page */}
          <div className="space-y-3 mb-6">
            <Label htmlFor="landingPageUrl" className="text-foreground font-medium">
              Campaign Landing Page
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="landingPageUrl"
                  type="url"
                  placeholder="https://www.yourpractice.com/campaign"
                  value={data.landingPageUrl}
                  onChange={(e) => handleLandingPageChange(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  id="createLandingPage"
                  checked={data.createLandingPage}
                  onCheckedChange={(checked) => 
                    onUpdate({ ...data, createLandingPage: checked as boolean })
                  }
                  disabled={!data.landingPageUrl.trim()}
                />
                <Label 
                  htmlFor="createLandingPage" 
                  className={`text-sm cursor-pointer ${!data.landingPageUrl.trim() ? 'text-muted-foreground' : ''}`}
                >
                  Create Landing Page
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {!data.landingPageUrl.trim() 
                ? 'No URL provided - a landing page will be created for this campaign'
                : 'Check to generate an optimized landing page for your campaign'}
            </p>
          </div>

          {/* Repository */}
          <div className="space-y-3">
            <Label className="text-foreground font-medium">
              Campaign Repository
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Upload documents specific to this campaign (research, product info, target group insights, etc.)
            </p>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDocuments}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Documents
              </Button>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="addNewRepository"
                  checked={data.addNewRepository}
                  onCheckedChange={(checked) => 
                    onUpdate({ ...data, addNewRepository: checked as boolean })
                  }
                />
                <Label htmlFor="addNewRepository" className="text-sm cursor-pointer">
                  Add New
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="createNewRepository"
                  checked={data.createNewRepository}
                  onCheckedChange={(checked) => 
                    onUpdate({ ...data, createNewRepository: checked as boolean })
                  }
                />
                <Label htmlFor="createNewRepository" className="text-sm cursor-pointer">
                  Create New
                </Label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleViewEditRepository}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                View/Edit Repository
              </Button>
            </div>

            {data.repositoryDocs.length > 0 && (
              <div className="mt-3 p-3 bg-accent/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Uploaded Documents ({data.repositoryDocs.length})</p>
                <div className="space-y-1">
                  {data.repositoryDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderOpen className="w-4 h-4" />
                      <span>{doc.name}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{doc.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
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
