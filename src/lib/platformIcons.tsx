import React from 'react';
import { Facebook, Instagram, Linkedin, Twitter, Mail, MessageSquare, Youtube, Music2, Plus } from 'lucide-react';
import { PlatformType, ChannelType } from '@/hooks/useCampaignsNew';

export const platformIcons: Record<PlatformType | 'custom', React.ReactNode> = {
  facebook: <Facebook className="w-full h-full" />,
  instagram: <Instagram className="w-full h-full" />,
  linkedin: <Linkedin className="w-full h-full" />,
  twitter: <Twitter className="w-full h-full" />,
  youtube: <Youtube className="w-full h-full" />,
  tiktok: <Music2 className="w-full h-full" />,
  mailchimp: <Mail className="w-full h-full" />,
  beehive: <Mail className="w-full h-full" />,
  internal_email: <Mail className="w-full h-full" />,
  internal_sms: <MessageSquare className="w-full h-full" />,
  custom: <Plus className="w-full h-full" />,
};

export const platformColors: Record<PlatformType | 'custom', string> = {
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white',
  linkedin: 'bg-blue-700 text-white',
  twitter: 'bg-black text-white',
  youtube: 'bg-red-600 text-white',
  tiktok: 'bg-black text-white',
  mailchimp: 'bg-yellow-400 text-black',
  beehive: 'bg-amber-500 text-white',
  internal_email: 'bg-primary text-primary-foreground',
  internal_sms: 'bg-green-600 text-white',
  custom: 'bg-muted text-muted-foreground border border-dashed border-border',
};

export const platformLabels: Record<PlatformType | 'custom', string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  mailchimp: 'MailChimp',
  beehive: 'Beehive',
  internal_email: 'Email',
  internal_sms: 'SMS',
  custom: 'Add New Channel',
};

export const channelLabels: Record<ChannelType, string> = {
  social_media: 'Social Media',
  email: 'Email',
  sms: 'Text/SMS',
};

export const getPlatformsByChannel = (channelType: ChannelType): PlatformType[] => {
  switch (channelType) {
    case 'social_media':
      return ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'];
    case 'email':
      return ['mailchimp', 'beehive', 'internal_email'];
    case 'sms':
      return ['internal_sms'];
  }
};

export const getChannelForPlatform = (platform: PlatformType): ChannelType => {
  switch (platform) {
    case 'facebook':
    case 'instagram':
    case 'linkedin':
    case 'twitter':
    case 'youtube':
    case 'tiktok':
      return 'social_media';
    case 'mailchimp':
    case 'beehive':
    case 'internal_email':
      return 'email';
    case 'internal_sms':
      return 'sms';
  }
};
