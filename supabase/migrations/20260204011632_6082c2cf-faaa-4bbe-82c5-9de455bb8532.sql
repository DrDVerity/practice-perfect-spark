-- Add YouTube and TikTok to the platform_type enum
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'youtube';
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'tiktok';