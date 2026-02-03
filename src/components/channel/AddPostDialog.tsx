import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Sparkles, Upload, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlatformType } from '@/hooks/useCampaignsNew';

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
  scheduled_start: string | null;
  scheduled_end: string | null;
}

const AddPostDialog: React.FC<AddPostDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  platform,
  campaignName,
  isSubmitting = false,
}) => {
  const { profile } = useProfile();
  
  // Required fields
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [targetAudience, setTargetAudience] = useState('');
  const [postFocus, setPostFocus] = useState('');
  
  // Optional fields
  const [landingPage, setLandingPage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Generated content
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetForm = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTargetAudience('');
    setPostFocus('');
    setLandingPage('');
    setUploadedFiles([]);
    setGeneratedTitle('');
    setGeneratedContent('');
    setGeneratedImageUrl('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
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

  // Auto Generate with AI
  const handleAutoGenerate = async () => {
    if (!startDate || !endDate || !targetAudience || !postFocus) {
      toast.error('Please fill in all required fields first');
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-post', {
        body: {
          platform,
          practiceName: profile?.practice_name || 'Our Practice',
          practiceEmail: profile?.email || '',
          websiteUrl: profile?.website_url || '',
          targetAudience,
          postFocus,
          landingPage,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          campaignName,
        },
      });

      if (error) throw error;

      if (data) {
        setGeneratedTitle(data.title || '');
        setGeneratedContent(data.content || '');
        if (data.imageUrl) {
          setGeneratedImageUrl(data.imageUrl);
        }
        toast.success('Post generated successfully!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate post. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

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

    await onSubmit({
      title: generatedTitle || postFocus,
      text_content: generatedContent || null,
      image_url: generatedImageUrl || null,
      scheduled_start: startDate.toISOString(),
      scheduled_end: endDate.toISOString(),
    });

    handleClose();
  };

  const isFormValid = startDate && endDate && targetAudience && postFocus;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Profile Info Display (read-only) */}
          {profile && (profile.practice_name || profile.email || profile.website_url) && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Using profile data:</p>
              {profile.practice_name && (
                <p className="text-sm"><span className="font-medium">Practice:</span> {profile.practice_name}</p>
              )}
              {profile.email && (
                <p className="text-sm"><span className="font-medium">Email:</span> {profile.email}</p>
              )}
              {profile.website_url && (
                <p className="text-sm"><span className="font-medium">Website:</span> {profile.website_url}</p>
              )}
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

          {/* Required: Post Focus */}
          <div className="space-y-2">
            <Label htmlFor="postFocus" className="text-sm font-medium">
              Post Focus <span className="text-destructive">*</span>
            </Label>
            <Input
              id="postFocus"
              value={postFocus}
              onChange={(e) => setPostFocus(e.target.value)}
              placeholder="e.g., Back to School, Best Dental Plans in Utah..."
            />
          </div>

          {/* Optional: Landing Page */}
          <div className="space-y-2">
            <Label htmlFor="landingPage" className="text-sm font-medium">
              Campaign Landing Page <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="landingPage"
              value={landingPage}
              onChange={(e) => setLandingPage(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Optional: File Upload with Drag & Drop */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Images & Resources <span className="text-muted-foreground">(optional)</span>
            </Label>
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

          {/* Auto Generate Button */}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleAutoGenerate}
            disabled={!isFormValid || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Auto Generate with AI
              </>
            )}
          </Button>

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
                  <div className="w-full max-w-sm rounded-lg overflow-hidden bg-muted">
                    <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
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
                Adding...
              </>
            ) : (
              'Add Post'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPostDialog;
