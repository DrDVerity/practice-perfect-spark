import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, RefreshCw, Loader2, Eye } from 'lucide-react';
import { fetchWeeklyReportPdf, useWeeklyReports, useGenerateWeeklyReport } from '@/hooks/useWeeklyReports';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PdfCanvasViewer from './PdfCanvasViewer';

interface Props {
  accountId?: string;
}

const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const WeeklyReportsCard: React.FC<Props> = ({ accountId }) => {
  const { data: reports = [], isLoading } = useWeeklyReports(accountId);
  const gen = useGenerateWeeklyReport(accountId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ blob: Blob; title: string } | null>(null);

  const handleGenerate = async () => {
    try {
      await gen.mutateAsync();
      toast({ title: 'Weekly report generated', description: 'Latest report is ready to download.' });
    } catch (e: any) {
      toast({ title: 'Failed to generate report', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const handleDownload = async (r: { id: string; pdf_url: string; week_start: string }) => {
    setDownloadingId(r.id);
    try {
      const { blob, filename } = await fetchWeeklyReportPdf(r.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `weekly-report-${r.week_start}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast({
        title: 'Download blocked',
        description: 'Your browser or an extension blocked the download. Try "View" instead or disable shield/ad-blocker for this page.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = async (r: { id: string; pdf_url: string; week_start: string }) => {
    setViewingId(r.id);
    try {
      const { blob } = await fetchWeeklyReportPdf(r.id);
      setViewer({ blob, title: `Weekly report ${r.week_start}` });
    } catch (e: any) {
      toast({
        title: 'Unable to open report',
        description: 'The PDF could not be loaded in the browser. Try downloading it, or disable shield/ad-blocker for this page.',
        variant: 'destructive',
      });
    } finally {
      setViewingId(null);
    }
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Weekly Marketing Reports
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Automatically emailed every Monday. Generate an on-demand report any time.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={gen.isPending || !accountId}>
          {gen.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
          Generate now
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : reports.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
            No weekly reports yet. Click <strong>Generate now</strong> to create one for the most recently completed week.
          </div>
        ) : (
          <div className="divide-y">
            {reports.map((r) => {
              const m = r.metrics_json?.current || {};
              return (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      Week of {fmt(r.week_start)} – {fmt(r.week_end)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {Number(m.leads || 0).toLocaleString()} leads · {Number(m.appointments || 0).toLocaleString()} appts · ${Number(m.spend || 0).toLocaleString()} spend
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleView(r)} disabled={viewingId === r.id}>
                      {viewingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 mr-2" />
                      )}
                      View Report
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(r)} disabled={downloadingId === r.id}>
                      {downloadingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-2" />
                      )}
                      PDF
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    <Dialog
      open={!!viewer}
      onOpenChange={(open) => {
        if (!open) setViewer(null);
      }}
    >
      <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-5xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-5 py-4 border-b">
          <DialogTitle>{viewer?.title || 'Weekly report'}</DialogTitle>
          <DialogDescription className="sr-only">
            Canvas-rendered weekly marketing report PDF preview.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          {viewer?.blob ? (
            <PdfCanvasViewer blob={viewer.blob} title={viewer.title} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default WeeklyReportsCard;
