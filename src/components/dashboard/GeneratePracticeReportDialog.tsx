import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FileSearch, Loader2, CheckCircle2, BookOpen } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPracticeName?: string;
  defaultWebsiteUrl?: string;
}

const GeneratePracticeReportDialog: React.FC<Props> = ({
  open,
  onClose,
  defaultPracticeName = '',
  defaultWebsiteUrl = '',
}) => {
  const { user } = useAuth();
  const [practiceName, setPracticeName] = useState(defaultPracticeName);
  const [websiteUrl, setWebsiteUrl] = useState(defaultWebsiteUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'generating' | 'done'>('input');

  const handleGenerate = async () => {
    if (!practiceName.trim() || !websiteUrl.trim()) {
      toast.error('Please fill in both fields');
      return;
    }
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setIsGenerating(true);
    setStep('generating');

    try {
      const { data, error } = await supabase.functions.invoke('generate-practice-report', {
        body: {
          practiceName: practiceName.trim(),
          websiteUrl: websiteUrl.trim(),
          userId: user.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReport(data.report);
      setStep('done');
      toast.success('Practice report generated and saved to Knowledge Base!');
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report', { description: err.message });
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setReport(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-primary" />
            Generate Practice Intelligence Report
          </DialogTitle>
          <DialogDescription>
            Scrapes the practice website, analyzes reviews & competitors, and generates a comprehensive SWOT & marketing report saved to your Knowledge Base.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="practiceName">Practice Name</Label>
              <Input
                id="practiceName"
                placeholder="e.g. Michael Watson DDS PC"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                placeholder="e.g. https://www.example-dental.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will scrape the practice website, search for online reviews, analyze nearby competitors, and generate a detailed intelligence report including SWOT analysis and marketing recommendations. All reports are automatically saved to the Knowledge Base.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={!practiceName.trim() || !websiteUrl.trim()}>
                <FileSearch className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Analyzing {practiceName}...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Scraping website, gathering reviews, analyzing competitors, and generating your comprehensive report. This may take 1-2 minutes.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mt-4">
              <p>✓ Scraping practice website...</p>
              <p>✓ Searching online reviews...</p>
              <p>✓ Analyzing competitive landscape...</p>
              <p>✓ Generating SWOT & marketing analysis...</p>
            </div>
          </div>
        )}

        {step === 'done' && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Report generated and saved to Knowledge Base</span>
            </div>
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {report}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="outline" onClick={() => window.open('/knowledge-base', '_blank')}>
                <BookOpen className="w-4 h-4 mr-2" />
                View in Knowledge Base
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GeneratePracticeReportDialog;
