import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, File as FileIcon } from 'lucide-react';
import type { KBDocument } from '@/hooks/useKnowledgeBase';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: KBDocument | null;
  docs: KBDocument[];
  onSelectDoc: (doc: KBDocument) => void;
}

function useIsMobilePortrait() {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const check = () => setIs(window.innerWidth < 768 && window.innerHeight >= window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return is;
}

function DocBody({ doc }: { doc: KBDocument }) {
  const meta = (doc.metadata || {}) as Record<string, any>;
  const fileUrl = meta.file_url as string | undefined;
  const fileKindMeta = meta.file_kind as 'image' | 'video' | 'document' | undefined;
  const mimeType = meta.mime_type as string | undefined;
  const isImage = fileKindMeta === 'image' || (mimeType?.startsWith('image/'));
  const isVideo = fileKindMeta === 'video' || (mimeType?.startsWith('video/'));
  const isPdf = mimeType === 'application/pdf';
  return (
    <div className="space-y-4">
      {fileUrl && isImage && (
        <img src={fileUrl} alt={doc.title} className="max-h-[60vh] w-auto mx-auto rounded-lg border" />
      )}
      {fileUrl && isVideo && (
        <video src={fileUrl} controls className="w-full max-h-[60vh] rounded-lg border" />
      )}
      {fileUrl && isPdf && (
        <iframe src={fileUrl} title={doc.title} className="w-full h-[60vh] rounded-lg border" />
      )}
      {fileUrl && !isImage && !isVideo && !isPdf && (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary underline">
          <FileIcon className="w-4 h-4" /> Open file
        </a>
      )}
      <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/50 p-4 rounded-lg overflow-x-auto">
        {doc.content}
      </pre>
    </div>
  );
}

export function KBDocumentViewer({ open, onOpenChange, doc, docs, onSelectDoc }: Props) {
  const isMobilePortrait = useIsMobilePortrait();
  const currentIndex = useMemo(
    () => (doc ? docs.findIndex(d => d.id === doc.id) : -1),
    [doc, docs]
  );
  const lastNavRef = useRef(0);

  const goPrev = () => {
    if (currentIndex > 0) onSelectDoc(docs[currentIndex - 1]);
  };
  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < docs.length - 1) onSelectDoc(docs[currentIndex + 1]);
  };

  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastNavRef.current < 250) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 10) return;
      lastNavRef.current = now;
      if (delta > 0) goNext(); else goPrev();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, currentIndex, docs]);

  if (!open || !doc) return null;

  if (isMobilePortrait) {
    // Render fullscreen overlay rotated 90deg to simulate landscape orientation.
    // Use width = viewport height, height = viewport width, then rotate around center.
    return (
      <div className="fixed inset-0 z-[100] bg-background">
        <div
          className="absolute top-1/2 left-1/2 bg-background overflow-y-auto"
          style={{
            width: '100vh',
            height: '100vw',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            transformOrigin: 'center center',
          }}
        >
          <div className="flex items-center justify-between gap-2 p-4 border-b sticky top-0 bg-background z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              disabled={currentIndex <= 0}
              aria-label="Previous report"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0 text-center">
              <h2 className="font-semibold truncate">{doc.title}</h2>
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} of {docs.length} · Alt + scroll to navigate
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              disabled={currentIndex < 0 || currentIndex >= docs.length - 1}
              aria-label="Next report"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <DocBody doc={doc} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              disabled={currentIndex <= 0}
              aria-label="Previous report"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              disabled={currentIndex < 0 || currentIndex >= docs.length - 1}
              aria-label="Next report"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <DialogTitle className="flex-1 truncate">{doc.title}</DialogTitle>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {currentIndex + 1} / {docs.length} · Alt+scroll
            </span>
          </div>
        </DialogHeader>
        <DocBody doc={doc} />
      </DialogContent>
    </Dialog>
  );
}

export default KBDocumentViewer;
