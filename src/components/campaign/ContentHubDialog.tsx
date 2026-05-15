/**
 * ContentHubDialog
 *
 * Step 1 of the new campaign content workflow.
 * Replaces the old "Accept plan → generate posts" button.
 *
 * Flow:
 *   1. User sees a text field to enter their own topic, or clicks "Suggest topics"
 *   2. AI returns 5 resonant topics; user picks one
 *   3. On confirm, calls generate-content-hub which writes blog_article + youtube_script
 *   4. When content_ready, parent calls generate-campaign-content to derive platform posts
 *
 * Props:
 *   campaignId       – the campaign being worked on
 *   existingTopic    – pre-fill if the campaign already has a content_topic
 *   onHubReady       – called after the hub job starts so parent can poll generation_status
 *   open / onOpenChange
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle2, Lightbulb } from 'lucide-react';
import { useContentHub } from '@/hooks/useContentHub';
import { toast } from 'sonner';

interface ContentHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  existingTopic?: string | null;
  onHubReady: () => void;
}

const ContentHubDialog: React.FC<ContentHubDialogProps> = ({
  open,
  onOpenChange,
  campaignId,
  existingTopic,
  onHubReady,
}) => {
  const [topic, setTopic] = useState(existingTopic || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<'user_provided' | 'ai_suggested'>(
    'user_provided'
  );

  const { getSuggestions, generateHub } = useContentHub();

  const handleSuggest = async () => {
    const result = await getSuggestions.mutateAsync(campaignId);
    setSuggestions(result.suggestions);
  };

  const handlePickSuggestion = (suggestion: string) => {
    setTopic(suggestion);
    setSelectedSource('ai_suggested');
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter or select a topic first.');
      return;
    }
    await generateHub.mutateAsync({
      campaignId,
      topic: topic.trim(),
      topicSource: selectedSource,
    });
    onHubReady();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Choose a Content Topic
          </DialogTitle>
          <DialogDescription>
            Enter your own topic or let AI suggest ones that will resonate with your audience.
            We'll write a full blog article and YouTube script, then derive all your platform posts
            from those two sources.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User topic input */}
          <div className="space-y-2">
            <Label htmlFor="content-topic">Your topic</Label>
            <div className="flex gap-2">
              <Input
                id="content-topic"
                placeholder="e.g. 5 Signs You Need a Dental Check-Up"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setSelectedSource('user_provided');
                }}
              />
            </div>
          </div>

          {/* AI suggestions */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggest}
              disabled={getSuggestions.isPending}
              className="w-full"
            >
              {getSuggestions.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4 mr-2" />
              )}
              {suggestions.length > 0 ? 'Refresh suggestions' : 'Suggest topics for my audience'}
            </Button>

            {suggestions.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">AI suggestions — click to select:</p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePickSuggestion(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      topic === s
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border hover:bg-accent text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {topic === s && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected topic preview */}
          {topic.trim() && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Selected topic</p>
                <p className="text-sm font-medium text-foreground truncate">{topic}</p>
              </div>
              <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                {selectedSource === 'ai_suggested' ? 'AI suggested' : 'Your topic'}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!topic.trim() || generateHub.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {generateHub.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate Content Hub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContentHubDialog;
