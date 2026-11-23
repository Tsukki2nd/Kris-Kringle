"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface WheelEntry {
  id: string;
  name: string;
}

interface WheelCanvasProps {
  entries: WheelEntry[];
  targetId: string | null;
  onFinished: () => void;
}

const TWO_PI = Math.PI * 2;
const SPIN_MS = 4600;
const EXTRA_TURNS = 5;
const INK = "#0A0A0A";
const CRIMSON = "#DC2626";
const EMERALD = "#16A34A";
const PALETTE = [
  { bg: CRIMSON, fg: "#FFFFFF" },
  { bg: "#F4F4F5", fg: INK },
  { bg: EMERALD, fg: "#FFFFFF" },
  { bg: INK, fg: "#FFFFFF" },
];

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function colorFor(i: number, n: number) {
  let idx = i % PALETTE.length;
  // avoid the last slice matching the first when wrapping
  if (n > 1 && i === n - 1 && idx === 0) idx = 2;
  return PALETTE[idx];
}

function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

export default function WheelCanvas({ entries, targetId, onFinished }: WheelCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const finishedRef = useRef(onFinished);
  const [size, setSize] = useState(320);

  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  // Responsive sizing
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize(Math.max(260, Math.min(520, Math.floor(el.clientWidth))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(
    (rotation: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const px = Math.round(size * dpr);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2 + 6;
      const bezelOuter = size / 2 - 22;
      const bezelWidth = 10;
      const radius = bezelOuter - bezelWidth;
      const n = entries.length;

      // Soft drop shadow under the whole wheel
      ctx.save();
      ctx.shadowColor = "rgba(10,10,10,0.18)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuter, 0, TWO_PI);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();

      // Slices
      if (n === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TWO_PI);
        ctx.fillStyle = "#F4F4F5";
        ctx.fill();
      } else {
        const seg = TWO_PI / n;
        const fontPx = Math.max(11, Math.min(16, radius * seg * 0.4));
        for (let i = 0; i < n; i++) {
          const start = rotation + i * seg;
          const end = start + seg;
          const { bg, fg } = colorFor(i, n);

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, radius, start, end);
          ctx.closePath();
          ctx.fillStyle = bg;
          ctx.fill();

          // hairline divider
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.stroke();

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(start + seg / 2);
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillStyle = fg;
          ctx.font = `500 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.fillText(fitLabel(ctx, entries[i].name, radius * 0.66), radius - 18, 0);
          ctx.restore();
        }
      }

      // Inner vignette ring for depth
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TWO_PI);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(10,10,10,0.25)";
      ctx.stroke();

      // Bezel dots (rotate with wheel)
      const dots = Math.max(12, n * 2);
      for (let i = 0; i < dots; i++) {
        const a = rotation + (i * TWO_PI) / dots;
        const r = radius + bezelWidth / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.8, 0, TWO_PI);
        ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : "rgba(255,255,255,0.45)";
        ctx.fill();
      }

      // Hub
      ctx.save();
      ctx.shadowColor = "rgba(10,10,10,0.25)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, TWO_PI);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, TWO_PI);
      ctx.fillStyle = CRIMSON;
      ctx.fill();

      // Pointer (top, pointing down)
      ctx.save();
      ctx.shadowColor = "rgba(10,10,10,0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 13, 4);
      ctx.lineTo(cx + 13, 4);
      ctx.lineTo(cx, 40);
      ctx.closePath();
      ctx.fillStyle = CRIMSON;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 13, 4);
      ctx.lineTo(cx + 13, 4);
      ctx.lineTo(cx, 40);
      ctx.closePath();
      ctx.stroke();
    },
    [entries, size]
  );

  // Redraw whenever inputs change
  useEffect(() => {
    draw(rotationRef.current);
  }, [draw]);

  // Spin when a target is provided
  useEffect(() => {
    if (!targetId || entries.length === 0) return;
    const idx = entries.findIndex((e) => e.id === targetId);
    if (idx < 0) return;

    const n = entries.length;
    const seg = TWO_PI / n;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const desired = -Math.PI / 2 - (idx + 0.5) * seg + jitter;
    const startRot = rotationRef.current;
    const delta = ((((desired - startRot) % TWO_PI) + TWO_PI) % TWO_PI) + TWO_PI * EXTRA_TURNS;
    const t0 = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / SPIN_MS);
      rotationRef.current = startRot + delta * easeOutCubic(t);
      draw(rotationRef.current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        finishedRef.current();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-[520px]">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="mx-auto block"
        aria-label="Wheel of names"
      />
    </div>
  );
}
