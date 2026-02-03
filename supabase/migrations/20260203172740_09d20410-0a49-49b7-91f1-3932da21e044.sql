-- Create enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('developing', 'scheduled', 'active', 'ended', 'canceled');

-- Create enum for channel types
CREATE TYPE public.channel_type AS ENUM ('social_media', 'email', 'sms');

-- Create enum for platform types
CREATE TYPE public.platform_type AS ENUM ('facebook', 'instagram', 'linkedin', 'twitter', 'mailchimp', 'beehive', 'internal_email', 'internal_sms');

-- Create campaigns table (top level)
CREATE TABLE public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    status campaign_status NOT NULL DEFAULT 'developing',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_channels table (middle level - links campaigns to channels)
CREATE TABLE public.campaign_channels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    channel_type channel_type NOT NULL,
    platform platform_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(campaign_id, platform)
);

-- Create channel_posts table (bottom level - actual content)
CREATE TABLE public.channel_posts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_channel_id UUID NOT NULL REFERENCES public.campaign_channels(id) ON DELETE CASCADE,
    title TEXT,
    text_content TEXT,
    image_url TEXT,
    video_url TEXT,
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaigns
CREATE POLICY "Users can view own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can create own campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
    FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- RLS policies for campaign_channels (based on campaign ownership)
CREATE POLICY "Users can view own campaign channels" ON public.campaign_channels
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND (user_id = auth.uid() OR is_admin(auth.uid())))
    );

CREATE POLICY "Users can create own campaign channels" ON public.campaign_channels
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can update own campaign channels" ON public.campaign_channels
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND (user_id = auth.uid() OR is_admin(auth.uid())))
    );

CREATE POLICY "Users can delete own campaign channels" ON public.campaign_channels
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND (user_id = auth.uid() OR is_admin(auth.uid())))
    );

-- RLS policies for channel_posts (based on campaign ownership through channel)
CREATE POLICY "Users can view own channel posts" ON public.channel_posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaign_channels cc
            JOIN public.campaigns c ON c.id = cc.campaign_id
            WHERE cc.id = campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()))
        )
    );

CREATE POLICY "Users can create own channel posts" ON public.channel_posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaign_channels cc
            JOIN public.campaigns c ON c.id = cc.campaign_id
            WHERE cc.id = campaign_channel_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own channel posts" ON public.channel_posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.campaign_channels cc
            JOIN public.campaigns c ON c.id = cc.campaign_id
            WHERE cc.id = campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()))
        )
    );

CREATE POLICY "Users can delete own channel posts" ON public.channel_posts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.campaign_channels cc
            JOIN public.campaigns c ON c.id = cc.campaign_id
            WHERE cc.id = campaign_channel_id AND (c.user_id = auth.uid() OR is_admin(auth.uid()))
        )
    );

-- Add triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_channels_updated_at
    BEFORE UPDATE ON public.campaign_channels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_channel_posts_updated_at
    BEFORE UPDATE ON public.channel_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();