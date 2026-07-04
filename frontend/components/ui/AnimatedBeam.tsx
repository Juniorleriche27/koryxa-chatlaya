"use client";
import { useEffect, useRef } from "react";

type Props = {
  className?: string;
};

export default function AnimatedBeam({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      t += 0.008;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      const beams = [
        { x1: 0, y1: h * 0.3, x2: w, y2: h * 0.7, color: "rgba(56,189,248,0.18)" },
        { x1: w * 0.1, y1: 0, x2: w * 0.9, y2: h, color: "rgba(99,102,241,0.14)" },
      ];

      for (const b of beams) {
        const ox = Math.sin(t) * 60;
        const oy = Math.cos(t * 0.7) * 40;
        const grad = ctx.createLinearGradient(b.x1 + ox, b.y1 + oy, b.x2, b.y2);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.45, b.color);
        grad.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x1 + ox, b.y1 + oy);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={`kx-beam-canvas ${className ?? ""}`} />;
}
