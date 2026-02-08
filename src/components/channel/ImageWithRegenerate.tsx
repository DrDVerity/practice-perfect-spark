import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Loader2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageWithRegenerateProps {
  imageUrl: string;
  platform: string;
  postFocus: string;
  targetAudience: string;
  campaignName?: string;
  practiceName?: string;
  onImageRegenerated: (newUrl: string, newPrompt: string) => void;
  initialPrompt?: string;
  className?: string;
}

const ImageWithRegenerate: React.FC<ImageWithRegenerateProps> = ({
  imageUrl,
  platform,
  postFocus,
  targetAudience,
  campaignName,
  practiceName,
  onImageRegenerated,
  initialPrompt,
  className = '',
}) => {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [prompt, setPrompt] = useState(
    initialPrompt || 
    `A dental practice marketing image for: ${postFocus || 'general dental services'}. Target audience: ${targetAudience || 'local patients'}. ${campaignName ? `Campaign: ${campaignName}.` : ''} ${practiceName ? `Practice: ${practiceName}.` : ''}`
  );

  const handleRegenerate = async (useNewPrompt: boolean = false) => {
    setIsRegenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: prompt,
          platform: platform,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        onImageRegenerated(data.imageUrl, prompt);
        toast.success('Image regenerated successfully!');
        setShowPromptEditor(false);
      } else {
        throw new Error('No image was generated');
      }
    } catch (error) {
      console.error('Image regeneration error:', error);
      toast.error('Failed to regenerate image. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      <div className="rounded-lg overflow-hidden bg-muted">
        <img src={imageUrl} alt="Generated" className="w-full h-auto" />
      </div>
      
      {/* Regenerate Button Overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowPromptEditor(true)}
          disabled={isRegenerating}
          className="gap-1.5"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </>
          )}
        </Button>
      </div>

      {/* Prompt Editor Dialog */}
      <Dialog open={showPromptEditor} onOpenChange={setShowPromptEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate Image</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-prompt">Image Prompt</Label>
              <Textarea
                id="image-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Edit the prompt to customize the generated image, or keep it as-is to get a new variation.
              </p>
            </div>

            {/* Current Image Preview */}
            <div className="space-y-2">
              <Label>Current Image</Label>
              <div className="w-full max-h-40 overflow-hidden rounded-lg bg-muted">
                <img src={imageUrl} alt="Current" className="w-full h-auto object-cover" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPromptEditor(false)} disabled={isRegenerating}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRegenerate(false)}
              disabled={isRegenerating}
              className="gap-1.5"
            >
              {isRegenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Regenerate Same
            </Button>
            <Button
              onClick={() => handleRegenerate(true)}
              disabled={isRegenerating}
              className="gap-1.5"
            >
              {isRegenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Generate New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageWithRegenerate;
