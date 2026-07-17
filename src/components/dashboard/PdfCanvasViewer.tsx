import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  blob: Blob;
  title: string;
}

const PdfPageCanvas: React.FC<{ pdf: pdfjsLib.PDFDocumentProxy; pageNumber: number }> = ({ pdf, pageNumber }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(760);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const updateWidth = () => setWidth(Math.max(320, node.clientWidth));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const renderPage = async () => {
      setIsRendering(true);
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min((width - 32) / baseViewport.width, 1.75);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.save();
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });

      await renderTask.promise;
      if (!cancelled) setIsRendering(false);
    };

    renderPage().catch((error) => {
      if (!cancelled && error?.name !== 'RenderingCancelledException') {
        setIsRendering(false);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, width]);

  return (
    <div ref={wrapperRef} className="relative flex justify-center px-4 py-5">
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full rounded-sm border border-border bg-card shadow-sm" />
    </div>
  );
};

const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ blob, title }) => {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      setPdf(null);
      setError(null);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      loadingTask = pdfjsLib.getDocument({ data: bytes });
      const document = await loadingTask.promise;
      if (!cancelled) setPdf(document);
    };

    loadPdf().catch((e) => {
      if (!cancelled) setError(String(e?.message || e));
    });

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [blob]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
        Unable to render {title}: {error}
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading report…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-muted/40" aria-label={title}>
      {Array.from({ length: pdf.numPages }, (_, index) => (
        <PdfPageCanvas key={index + 1} pdf={pdf} pageNumber={index + 1} />
      ))}
    </div>
  );
};

export default PdfCanvasViewer;