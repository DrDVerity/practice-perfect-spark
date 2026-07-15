// Brand + platform chart palette. HSL/hex values chosen to align with the
// Archer visual identity (dark navy, gold accents) and each platform's
// well-known brand color.

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  twitter: '#111111',
  x: '#111111',
  youtube: '#FF0033',
  tiktok: '#00F2EA',
  internal_email: '#BB9A4F', // Archer gold
  internal_sms: '#22C55E',
  mailchimp: '#FFE01B',
  beehive: '#F59E0B',
  custom: '#64748B',
};

export const KPI_BRAND = {
  navy: '#001F5B',
  gold: '#BB9A4F',
  goldLight: '#E8C96C',
  azure: '#4EA8DE',
  danger: '#DC2626',
  success: '#16A34A',
};

export const platformColor = (p: string) =>
  PLATFORM_COLORS[(p || '').toLowerCase()] || KPI_BRAND.gold;

export const platformLabel = (p: string) => {
  const key = (p || '').toLowerCase();
  const map: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    twitter: 'X / Twitter',
    x: 'X / Twitter',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    internal_email: 'Email',
    internal_sms: 'SMS',
    mailchimp: 'Mailchimp',
    beehive: 'Beehive',
    custom: 'Custom',
  };
  return map[key] || p;
};
