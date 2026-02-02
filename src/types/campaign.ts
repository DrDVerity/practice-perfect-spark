export interface PracticeData {
  practiceName: string;
  email: string;
  targetAudience: string;
  websiteUrl: string;
  campaignFocus: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  textCopy: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
}

export interface BrandDNA {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  tone: string;
}

export interface GapAnalysis {
  complaints: string[];
  desires: string[];
  opportunities: string[];
}

export interface User {
  id: string;
  practiceId: string;
  email: string;
  practiceName: string;
  authStatus: boolean;
}

export interface Profile {
  practiceId: string;
  websiteUrl: string;
  brandDnaUrl?: string;
  socialAuthToken?: string;
}

export type OnboardingStep = 'welcome' | 'basic-info' | 'campaign-details' | 'generating' | 'preview';
