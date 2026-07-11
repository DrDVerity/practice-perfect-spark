import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, Globe, Users, Lightbulb, Link2, FileText, Eye, X, Plus } from 'lucide-react';
import { RepositoryDocument } from '@/types/campaign';
import { RepositoryModal } from './RepositoryModal';

interface CampaignDetailsData {
  targetAudience: string[];
  websiteUrl: string;
  campaignFocus: string;
  landingPageUrl: string;
  createLandingPage: boolean;
  repositoryDocs: RepositoryDocument[];
  addNewRepository: boolean;
  createNewRepository: boolean;
}

interface CampaignDetailsStepProps {
  data: CampaignDetailsData;
  onUpdate: (data: CampaignDetailsData) => void;
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

/** Prefix bare domains with https://www. and https:// for www.-only inputs. */
function normalizeUrl(input: string): string {
  const v = (input || '').trim();
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return `https://www.${v}`;
}

export const CampaignDetailsStep: React.FC<CampaignDetailsStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<{ targetAudience?: string; websiteUrl?: string; campaignFocus?: string }>({});
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);
  const [customAudience, setCustomAudience] = useState('');

  useEffect(() => {
    if (!data.landingPageUrl.trim() && !data.createLandingPage) {
      onUpdate({ ...data, createLandingPage: true });
    }
  }, [data.landingPageUrl]);

  useEffect(() => {
    if (data.repositoryDocs.length === 0 && !data.createNewRepository) {
      onUpdate({ ...data, createNewRepository: true });
    } else if (data.repositoryDocs.length > 0 && data.createNewRepository) {
      onUpdate({ ...data, createNewRepository: false });
    }
  }, [data.repositoryDocs.length]);

  const toggleAudience = (value: string) => {
    const has = data.targetAudience.includes(value);
    onUpdate({
      ...data,
      targetAudience: has
        ? data.targetAudience.filter((a) => a !== value)
        : [...data.targetAudience, value],
    });
  };

  const addCustomAudience = () => {
    const v = customAudience.trim();
    if (!v) return;
    if (!data.targetAudience.includes(v)) {
      onUpdate({ ...data, targetAudience: [...data.targetAudience, v] });
    }
    setCustomAudience('');
  };

  const validateAndNext = () => {
    const newErrors: typeof errors = {};
    const normalized = normalizeUrl(data.websiteUrl);

    if (data.targetAudience.length === 0) {
      newErrors.targetAudience = 'Select at least one target audience';
    }
    if (!normalized) {
      newErrors.websiteUrl = 'Website URL is required';
    } else if (!/^https?:\/\/.+\..+/.test(normalized)) {
      newErrors.websiteUrl = 'Enter a valid URL (e.g. www.yourpractice.com)';
    }
    if (!data.campaignFocus.trim()) {
      newErrors.campaignFocus = 'Campaign focus is required';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      // Persist normalized URLs
      onUpdate({
        ...data,
        websiteUrl: normalized,
        landingPageUrl: normalizeUrl(data.landingPageUrl),
      });
      onNext();
    }
  };

  const handleLandingPageChange = (url: string) => {
    onUpdate({
      ...data,
      landingPageUrl: url,
      createLandingPage: url.trim() === '' ? true : data.createLandingPage,
    });
  };

  const handleAddDocument = (doc: RepositoryDocument) => {
    onUpdate({ ...data, repositoryDocs: [...data.repositoryDocs, doc] });
  };

  const handleRemoveDocument = (id: string) => {
    onUpdate({ ...data, repositoryDocs: data.repositoryDocs.filter((d) => d.id !== id) });
  };

  const selectedSet = new Set(data.targetAudience);

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Define Your Campaign</h2>
        <p className="text-muted-foreground">
          Help us understand who you want to reach and what you want to promote
        </p>
      </div>

      <div className="space-y-6 bg-card p-8 rounded-2xl border border-border shadow-lg">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          New Campaign
        </h3>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl" className="text-foreground font-medium">Practice Website URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="websiteUrl"
              type="text"
              placeholder="www.yourpractice.com"
              value={data.websiteUrl}
              onChange={(e) => onUpdate({ ...data, websiteUrl: e.target.value })}
              onBlur={(e) => {
                const n = normalizeUrl(e.target.value);
                if (n !== e.target.value) onUpdate({ ...data, websiteUrl: n });
              }}
              className={`pl-10 h-12 ${errors.websiteUrl ? 'border-destructive' : ''}`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            No https:// needed, we'll add it. We'll scrape your site to match your brand.
          </p>
          {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl}</p>}
        </div>

        {/* Campaign focus */}
        <div className="space-y-2">
          <Label htmlFor="campaignFocus" className="text-foreground font-medium">Campaign Focus Idea</Label>
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
          {errors.campaignFocus && <p className="text-sm text-destructive">{errors.campaignFocus}</p>}
        </div>

        {/* Target audience, multi-select */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Target Audience (select all that apply)
          </Label>

          <div className="flex flex-wrap gap-2">
            {audienceSuggestions.map((suggestion) => {
              const selected = selectedSet.has(suggestion);
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => toggleAudience(suggestion)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-accent text-accent-foreground border-transparent hover:bg-primary/20'
                  }`}
                >
                  {suggestion}
                  {selected && <X className="inline w-3 h-3 ml-1 -mt-0.5" />}
                </button>
              );
            })}
            {data.targetAudience
              .filter((a) => !audienceSuggestions.includes(a))
              .map((custom) => (
                <button
                  key={custom}
                  type="button"
                  onClick={() => toggleAudience(custom)}
                  className="px-3 py-1.5 text-xs rounded-full border bg-primary text-primary-foreground border-primary"
                >
                  {custom}
                  <X className="inline w-3 h-3 ml-1 -mt-0.5" />
                </button>
              ))}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add a custom audience"
              value={customAudience}
              onChange={(e) => setCustomAudience(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomAudience();
                }
              }}
              className="h-10"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomAudience}
              disabled={!customAudience.trim()}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          {errors.targetAudience && <p className="text-sm text-destructive">{errors.targetAudience}</p>}
        </div>

        {/* Landing Page */}
        <div className="border-t border-border pt-6 mt-6">
          <div className="space-y-3 mb-6">
            <Label htmlFor="landingPageUrl" className="text-foreground font-medium">Campaign Landing Page</Label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="landingPageUrl"
                  type="text"
                  placeholder="www.yourpractice.com/campaign"
                  value={data.landingPageUrl}
                  onChange={(e) => handleLandingPageChange(e.target.value)}
                  onBlur={(e) => {
                    const n = normalizeUrl(e.target.value);
                    if (n !== e.target.value) handleLandingPageChange(n);
                  }}
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
                ? 'No URL provided, a landing page will be created for this campaign'
                : 'Check to generate an optimized landing page for your campaign'}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground font-medium">Campaign Repository</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Upload documents specific to this campaign (research, product info, target group insights, etc.)
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="createNewRepository"
                  checked={data.createNewRepository}
                  onCheckedChange={(checked) =>
                    onUpdate({ ...data, createNewRepository: checked as boolean })
                  }
                  disabled={data.repositoryDocs.length === 0}
                />
                <Label
                  htmlFor="createNewRepository"
                  className={`text-sm cursor-pointer ${data.repositoryDocs.length === 0 ? 'text-muted-foreground' : ''}`}
                >
                  Create New
                </Label>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRepositoryModalOpen(true)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                View/Edit Repository
                {data.repositoryDocs.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {data.repositoryDocs.length}
                  </span>
                )}
              </Button>
            </div>

            {data.repositoryDocs.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No documents yet. Click "View/Edit Repository" to upload files for the AI to use.
              </p>
            )}
          </div>
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

      <RepositoryModal
        open={repositoryModalOpen}
        onOpenChange={setRepositoryModalOpen}
        documents={data.repositoryDocs}
        onAddDocument={handleAddDocument}
        onRemoveDocument={handleRemoveDocument}
        campaignFocus={data.campaignFocus}
        targetAudience={data.targetAudience.join(', ')}
      />
    </div>
  );
};
