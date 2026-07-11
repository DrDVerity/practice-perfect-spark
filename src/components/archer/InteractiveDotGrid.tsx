import { useEffect, useRef } from "react";

/**
 * Subtle, cursor-responsive dot grid on a dark canvas. Self-contained (no deps).
 * Dots near the pointer gently grow and shift from steel toward gold, with a
 * soft gold glow tracking the cursor. Falls back to a static grid on touch
 * devices and when the user prefers reduced motion. Inspired by bb1fx rb-dot-grid.
 */
export function InteractiveDotGrid({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = (q: string) => (typeof window.matchMedia === "function" ? window.matchMedia(q).matches : false);
    const reduce = mq("(prefers-reduced-motion: reduce)");
    const fine = mq("(pointer: fine)");
    const interactive = fine && !reduce;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const gap = 30;
    const dotR = 1.25;
    const proximity = 150;
    const mouse = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let raf = 0;

    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!interactive) draw();
    };

    function draw() {
      ctx.clearRect(0, 0, width, height);

      if (interactive && mouse.x > -9000) {
        const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, proximity * 1.7);
        glow.addColorStop(0, "rgba(187,154,79,0.10)");
        glow.addColorStop(1, "rgba(187,154,79,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      for (let y = gap; y < height; y += gap) {
        for (let x = gap; x < width; x += gap) {
          let t = 0;
          if (interactive && mouse.x > -9000) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < proximity) t = 1 - dist / proximity;
          }
          const r = dotR + t * 1.9;
          const alpha = 0.16 + t * 0.6;
          ctx.fillStyle =
            t > 0.02
              ? `rgba(${lerp(120, 232, t)},${lerp(140, 201, t)},${lerp(160, 108, t)},${alpha})`
              : `rgba(120,140,160,${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (interactive) raf = requestAnimationFrame(draw);
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    if (interactive) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
