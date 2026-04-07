import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface AddonInfo {
  key: string;
  label: string;
  icon: string;
  description: string;
}

export const CAMPAIGN_ADDONS: AddonInfo[] = [
  {
    key: 'google_ads',
    label: 'Google Ads',
    icon: '🔍',
    description: 'Run targeted search and display ads on Google to capture patients actively searching for dental/healthcare services. Google Ads consistently delivers high-intent leads with measurable ROI for healthcare practices.',
  },
  {
    key: 'lsa',
    label: 'Local Service Ads',
    icon: '📍',
    description: 'Google Local Service Ads appear at the very top of search results with a "Google Guaranteed" badge. You only pay per lead (not per click), making them extremely cost-effective for local healthcare practices.',
  },
  {
    key: 'geotargeted',
    label: 'Geotargeted Campaigns',
    icon: '🎯',
    description: 'Deliver ads to potential patients within a specific geographic radius of your practice. Geofencing and geo-targeting ensure your marketing budget reaches only the most relevant local audience.',
  },
  {
    key: 'influencer',
    label: 'Influencer Marketing',
    icon: '⭐',
    description: 'Partner with local health & wellness influencers to authentically promote your practice. Influencer endorsements build trust and can dramatically expand your reach among younger demographics.',
  },
  {
    key: 'direct_mail',
    label: 'Direct Mail',
    icon: '📬',
    description: 'Targeted direct mail campaigns (postcards, brochures) to households in your service area. Despite being "traditional," direct mail achieves 5-9% response rates in healthcare — far above digital averages.',
  },
  {
    key: 'billboards_ooh',
    label: 'Billboards / OOH',
    icon: '🏗️',
    description: 'Out-of-home advertising like billboards, bus shelters, and transit ads build top-of-mind awareness in your local market. Ideal for establishing brand presence in high-traffic corridors near your practice.',
  },
  {
    key: 'radio_podcast',
    label: 'Radio / Podcast Ads',
    icon: '🎙️',
    description: 'Audio advertising on local radio stations or health-focused podcasts reaches commuters and engaged listeners. Host-read podcast ads are particularly effective for building trust with health-conscious audiences.',
  },
  {
    key: 'referral_program',
    label: 'Referral Programs',
    icon: '🤝',
    description: 'Structured patient referral programs incentivize your best patients to recommend your practice. Referral patients have 16% higher lifetime value and 37% higher retention rates than other acquisition channels.',
  },
  {
    key: 'community_events',
    label: 'Community Events',
    icon: '🎪',
    description: 'Sponsor or host local health fairs, school events, charity runs, and community workshops. These build genuine community relationships and position your practice as a trusted local healthcare leader.',
  },
  {
    key: 'content_marketing',
    label: 'Content Marketing',
    icon: '📝',
    description: 'Blog posts, educational articles, and video content establish your practice as an authority. Content marketing generates 3x more leads than outbound marketing and costs 62% less over time.',
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addon: AddonInfo | null;
  onInclude: (addonKey: string) => void;
  isIncluded: boolean;
  isPending: boolean;
}

const CampaignAddonDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  addon,
  onInclude,
  isIncluded,
  isPending,
}) => {
  if (!addon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{addon.icon}</span>
            {addon.label}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed">
            {addon.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isIncluded ? (
            <Button disabled variant="secondary">
              ✓ Already Included
            </Button>
          ) : (
            <Button onClick={() => onInclude(addon.key)} disabled={isPending}>
              Include in Campaign
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignAddonDialog;
