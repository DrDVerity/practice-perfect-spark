import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Sparkles, Upload, X, Loader2, ImagePlus, Plus, Pencil, Video, RefreshCw, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlatformType } from '@/hooks/useCampaignsNew';
import { useAuth } from '@/hooks/useAuth';
import { useChannelCredentials } from '@/hooks/useChannelCredentials';
import ChannelCredentialModal, { ChannelCredentials } from './ChannelCredentialModal';
import ImageWithRegenerate from './ImageWithRegenerate';

interface AddPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PostFormData) => Promise<void>;
  platform: PlatformType;
  campaignName?: string;
  isSubmitting?: boolean;
}

export interface PostFormData {
  title: string | null;
  text_content: string | null;
  image_url: string | null;
  video_url?: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

interface ExistingPost {
  id: string;
  title: string | null;
  text_content: string | null;
  image_url: string | null;
  platform: string;
}

interface CampaignLandingPage {
  id: string;
  url: string;
  postCount: number;
}

// Available channel options
const CHANNEL_OPTIONS: { value: PlatformType | 'other'; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'mailchimp', label: 'Mailchimp' },
  { value: 'beehive', label: 'Beehive' },
  { value: 'internal_email', label: 'Internal Email' },
  { value: 'internal_sms', label: 'Internal SMS' },
  { value: 'other', label: 'Other...' },
];

const AddPostDialog: React.FC<AddPostDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  platform,
  campaignName,
  isSubmitting = false,
}) => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { credentials } = useChannelCredentials();
  
  // Channel selection
  const [selectedChannel, setSelectedChannel] = useState<PlatformType | 'other'>(platform);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialGateMode, setCredentialGateMode] = useState(false);
  const [customChannels, setCustomChannels] = useState<ChannelCredentials[]>([]);
  
  // Post template selection
  const [existingPosts, setExistingPosts] = useState<ExistingPost[]>([]);
  const [selectedPostTemplate, setSelectedPostTemplate] = useState<string>('new');
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  
  // Required fields
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [targetAudience, setTargetAudience] = useState('');
  const [postFocus, setPostFocus] = useState('');
  
  // Landing page fields
  const [landingPage, setLandingPage] = useState('');
  const [createLandingPage, setCreateLandingPage] = useState(false);
  const [campaignLandingPages, setCampaignLandingPages] = useState<CampaignLandingPage[]>([]);
  
  // Video generation
  const [videoUrl, setVideoUrl] = useState('');
  const [generateVideo, setGenerateVideo] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoScript, setVideoScript] = useState('');
  
  // File upload
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Generated content
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Check if credentials exist for the active platform
  const getActivePlatform = () => selectedChannel === 'other' ? platform : selectedChannel;
  
  const hasCredentialsForPlatform = useCallback((platformName: string) => {
    // Internal channels don't need external credentials
    if (['internal_email', 'internal_sms'].includes(platformName)) return true;
    return credentials.some(
      (c) => c.platform_name.toLowerCase() === platformName.toLowerCase()
    );
  }, [credentials]);

  // Auto-check "Create landing page" if landing page is empty
  useEffect(() => {
    if (!landingPage && campaignLandingPages.length === 0) {
      setCreateLandingPage(true);
    }
  }, [landingPage, campaignLandingPages]);

  // Fetch existing posts for templates and landing pages
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !user) return;
      
      setIsLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from('channel_posts')
          .select(`
            id,
            title,
            text_content,
            image_url,
            campaign_channels!inner (
              platform,
              campaigns!inner (
                user_id
              )
            )
          `)
          .limit(50);

        if (error) throw error;

        const posts = (data || []).map((post: any) => ({
          id: post.id,
          title: post.title,
          text_content: post.text_content,
          image_url: post.image_url,
          platform: post.campaign_channels?.platform || 'unknown',
        }));

        setExistingPosts(posts);
        const mockLandingPages: CampaignLandingPage[] = [];
        setCampaignLandingPages(mockLandingPages);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    fetchData();
  }, [open, user]);

  // Handle channel selection
  const handleChannelChange = (value: string) => {
    if (value === 'other') {
      setShowCredentialModal(true);
    } else {
      setSelectedChannel(value as PlatformType | 'other');
    }
  };

  // Handle custom channel credentials
  const handleCredentialSubmit = (creds: ChannelCredentials) => {
    setCustomChannels(prev => [...prev, creds]);
    setCredentialGateMode(false);
    toast.success(`Channel "${creds.platformName}" added`);
  };

  // Handle post template selection
  const handleTemplateChange = (value: string) => {
    setSelectedPostTemplate(value);
    
    if (value !== 'new') {
      const template = existingPosts.find(p => p.id === value);
      if (template) {
        setGeneratedTitle(template.title || '');
        setGeneratedContent(template.text_content || '');
        setGeneratedImageUrl(template.image_url || '');
        setPostFocus(template.title || '');
        toast.success('Template loaded! You can edit the content below.');
      }
    } else {
      setGeneratedTitle('');
      setGeneratedContent('');
      setGeneratedImageUrl('');
      setPostFocus('');
    }
  };

  const resetForm = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTargetAudience('');
    setPostFocus('');
    setLandingPage('');
    setCreateLandingPage(false);
    setVideoUrl('');
    setGenerateVideo(false);
    setVideoScript('');
    setUploadedFiles([]);
    setGeneratedTitle('');
    setGeneratedContent('');
    setGeneratedImageUrl('');
    setImagePrompt('');
    setSelectedChannel(platform);
    setSelectedPostTemplate('new');
    setCredentialGateMode(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Credential gate check
  const requireCredentials = (action: () => void) => {
    const activePlatform = getActivePlatform();
    if (!hasCredentialsForPlatform(activePlatform)) {
      setCredentialGateMode(true);
      setShowCredentialModal(true);
      return;
    }
    action();
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Auto Generate single preview with AI
  const handleAutoGenerate = async () => {
    if (!startDate || !endDate || !targetAudience || !postFocus) {
      toast.error('Please fill in all required fields first');
      return;
    }

    setIsGenerating(true);
    
    try {
      const activePlatform = getActivePlatform();
      
      const { data, error } = await supabase.functions.invoke('generate-post', {
        body: {
          platform: activePlatform,
          practiceName: profile?.practice_name || 'Our Practice',
          practiceEmail: profile?.email || '',
          websiteUrl: profile?.website_url || '',
          targetAudience,
          postFocus,
          landingPage,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          campaignName,
          variationCount: 1,
        },
      });

      if (error) throw error;

      if (data?.variations?.[0]) {
        const v = data.variations[0];
        setGeneratedTitle(v.title || '');
        setGeneratedContent(v.content || '');
        toast.success('Post generated successfully!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate post. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto Generate Image with AI (lazy — only on demand)
  const handleGenerateImage = async () => {
    if (!postFocus && !targetAudience) {
      toast.error('Please enter target audience or post focus first');
      return;
    }

    setIsGeneratingImage(true);
    
    try {
      const activePlatform = getActivePlatform();
      const newPrompt = `A dental practice marketing image for: ${postFocus || 'general dental services'}. Target audience: ${targetAudience || 'local patients'}. ${campaignName ? `Campaign: ${campaignName}.` : ''} ${profile?.practice_name ? `Practice: ${profile.practice_name}.` : ''}`;
      setImagePrompt(newPrompt);

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: newPrompt,
          platform: activePlatform,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast.success('Image generated successfully!');
      } else {
        throw new Error('No image was generated');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      toast.error('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Generate Video
  const handleGenerateVideo = async () => {
    if (!postFocus && !targetAudience) {
      toast.error('Please enter target audience or post focus first');
      return;
    }

    setIsGeneratingVideo(true);
    
    try {
      const activePlatform = getActivePlatform();

      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          platform: activePlatform,
          targetAudience,
          postFocus,
          campaignName,
          practiceName: profile?.practice_name,
        },
      });

      if (error) throw error;

      if (data?.script) {
        setVideoScript(data.script);
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
        }
        toast.success('Video concept generated successfully!');
      }
    } catch (error) {
      console.error('Video generation error:', error);
      toast.error('Failed to generate video concept. Please try again.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Handle image regeneration
  const handleImageRegenerated = (newUrl: string, newPrompt: string) => {
    setGeneratedImageUrl(newUrl);
    setImagePrompt(newPrompt);
  };

  // Submit: batch-generate 3 variations in single call, lazy images
  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Start and end dates are required');
      return;
    }

    if (!targetAudience) {
      toast.error('Target audience is required');
      return;
    }

    if (!postFocus) {
      toast.error('Post focus is required');
      return;
    }

    // Credential gate
    const activePlatform = getActivePlatform();
    if (!hasCredentialsForPlatform(activePlatform)) {
      setCredentialGateMode(true);
      setShowCredentialModal(true);
      return;
    }

    setIsGenerating(true);
    toast.info('Generating 3 post variations...');

    try {
      // Single API call for 3 text variations
      const { data, error } = await supabase.functions.invoke('generate-post', {
        body: {
          platform: activePlatform,
          practiceName: profile?.practice_name || 'Our Practice',
          practiceEmail: profile?.email || '',
          websiteUrl: profile?.website_url || '',
          targetAudience,
          postFocus,
          landingPage,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          campaignName,
          variationCount: 3,
        },
      });

      if (error) throw error;

      const variations = data?.variations || [];
      
      if (variations.length === 0) {
        throw new Error('No variations generated');
      }

      // Submit each variation WITHOUT auto-generating images (lazy approach)
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];

        // Generate video only if enabled (for first variation only to save costs)
        let postVideoUrl = null;
        if (generateVideo && i === 0) {
          try {
            const { data: videoData } = await supabase.functions.invoke('generate-video', {
              body: {
                platform: activePlatform,
                targetAudience,
                postFocus: v.title || postFocus,
                campaignName,
                practiceName: profile?.practice_name,
              },
            });
            if (videoData?.videoUrl) {
              postVideoUrl = videoData.videoUrl;
            }
          } catch (vidError) {
            console.error(`Error generating video:`, vidError);
          }
        }

        await onSubmit({
          title: v.title || `${postFocus} - Variation ${i + 1}`,
          text_content: v.content || null,
          image_url: null, // Images generated on-demand via Edit Post
          video_url: postVideoUrl,
          scheduled_start: startDate.toISOString(),
          scheduled_end: endDate.toISOString(),
        });
      }

      toast.success('3 post variations created! Open each post to generate images.');
      handleClose();
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate posts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const isFormValid = startDate && endDate && targetAudience && postFocus;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
          </DialogHeader>
          
          {/* Credential warning banner */}
          {!hasCredentialsForPlatform(getActivePlatform()) && !['internal_email', 'internal_sms'].includes(getActivePlatform()) && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
              <KeyRound className="w-5 h-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Credentials required</p>
                <p className="text-muted-foreground">
                  Add credentials for <strong>{getActivePlatform()}</strong> before generating or scheduling posts.
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setCredentialGateMode(true);
                  setShowCredentialModal(true);
                }}
              >
                Add Now
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {/* Profile Info Display (read-only) */}
            {profile?.practice_name && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Name:</span>{' '}
                  <span className="text-foreground">{profile.practice_name}</span>
                </p>
              </div>
            )}

            {/* Required: Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Start Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Select start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  End Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Select end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Channel <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedChannel} onValueChange={handleChannelChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  {customChannels.map((channel, index) => (
                    <SelectItem key={`custom-${index}`} value={`custom-${index}`}>
                      {channel.platformName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Required: Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="targetAudience" className="text-sm font-medium">
                Target Audience <span className="text-destructive">*</span>
              </Label>
              <Input
                id="targetAudience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Adults in Chicago who are nervous about going to the dentist"
              />
            </div>

            {/* Post Focus - Template Selection or New */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Post Focus <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select 
                  value={selectedPostTemplate} 
                  onValueChange={handleTemplateChange}
                  disabled={isLoadingPosts}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={isLoadingPosts ? "Loading posts..." : "Select a template or create new"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="new">
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        New Post
                      </span>
                    </SelectItem>
                    {existingPosts.map((post) => (
                      <SelectItem key={post.id} value={post.id}>
                        <span className="truncate">
                          {post.title || post.text_content?.substring(0, 40) || 'Untitled Post'} 
                          <span className="text-muted-foreground ml-1">({post.platform})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Post Focus Input (always shown) */}
              <Input
                id="postFocus"
                value={postFocus}
                onChange={(e) => setPostFocus(e.target.value)}
                placeholder="e.g., Back to School, Best Dental Plans in Utah..."
                className="mt-2"
              />
            </div>

            {/* Landing Page with Smart Logic */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="landingPage" className="text-sm font-medium">
                  Campaign Landing Page
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="createLandingPage"
                    checked={createLandingPage}
                    onCheckedChange={(checked) => setCreateLandingPage(checked === true)}
                  />
                  <Label htmlFor="createLandingPage" className="text-sm cursor-pointer">
                    Create campaign-specific landing page
                  </Label>
                </div>
              </div>
              
              {campaignLandingPages.length > 1 ? (
                <Select value={landingPage} onValueChange={setLandingPage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select existing landing page or create new" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="new">
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create New Landing Page
                      </span>
                    </SelectItem>
                    {campaignLandingPages.map((lp) => (
                      <SelectItem key={lp.id} value={lp.url}>
                        {lp.url} ({lp.postCount} posts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="landingPage"
                  value={landingPage}
                  onChange={(e) => {
                    setLandingPage(e.target.value);
                    if (e.target.value) {
                      setCreateLandingPage(false);
                    }
                  }}
                  placeholder="https://..."
                  disabled={createLandingPage}
                />
              )}
            </div>

            {/* Video URL and Generation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="videoUrl" className="text-sm font-medium">
                  Video
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="generateVideo"
                    checked={generateVideo}
                    onCheckedChange={setGenerateVideo}
                  />
                  <Label htmlFor="generateVideo" className="text-sm cursor-pointer">
                    Generate promotional video
                  </Label>
                </div>
              </div>
              
              {generateVideo ? (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requireCredentials(handleGenerateVideo)}
                    disabled={isGeneratingVideo || (!postFocus && !targetAudience)}
                    className="w-full gap-2"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Video Concept...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        Generate Video Concept
                      </>
                    )}
                  </Button>
                  
                  {videoScript && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium text-primary mb-2">Video Script Generated:</p>
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-6">{videoScript}</p>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  id="videoUrl"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                />
              )}
            </div>

            {/* Optional: File Upload with Drag & Drop */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Images & Resources <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requireCredentials(handleGenerateImage)}
                  disabled={isGeneratingImage || (!postFocus && !targetAudience)}
                  className="gap-1.5"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-3.5 h-3.5" />
                      AI Generate
                    </>
                  )}
                </Button>
              </div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                  isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </div>
              
              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generated Content Preview */}
            {(generatedTitle || generatedContent) && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <p className="text-sm font-medium text-primary">Generated Content:</p>
                
                {generatedTitle && (
                  <div className="space-y-2">
                    <Label htmlFor="generatedTitle" className="text-sm">Title</Label>
                    <Input
                      id="generatedTitle"
                      value={generatedTitle}
                      onChange={(e) => setGeneratedTitle(e.target.value)}
                    />
                  </div>
                )}
                
                {generatedContent && (
                  <div className="space-y-2">
                    <Label htmlFor="generatedContent" className="text-sm">Content</Label>
                    <Textarea
                      id="generatedContent"
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      rows={6}
                    />
                  </div>
                )}

                {generatedImageUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm">Generated Image</Label>
                    <ImageWithRegenerate
                      imageUrl={generatedImageUrl}
                      platform={getActivePlatform()}
                      postFocus={postFocus}
                      targetAudience={targetAudience}
                      campaignName={campaignName}
                      practiceName={profile?.practice_name || undefined}
                      onImageRegenerated={handleImageRegenerated}
                      initialPrompt={imagePrompt}
                      className="max-w-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline"
              onClick={() => requireCredentials(handleAutoGenerate)}
              disabled={!isFormValid || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Post
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Credential Modal (also used for credential gate) */}
      <ChannelCredentialModal
        open={showCredentialModal}
        onOpenChange={(o) => {
          setShowCredentialModal(o);
          if (!o) setCredentialGateMode(false);
        }}
        onSubmit={handleCredentialSubmit}
      />
    </>
  );
};

export default AddPostDialog;