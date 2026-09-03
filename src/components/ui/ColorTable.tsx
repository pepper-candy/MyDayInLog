"use client";

import {
  candyColorAt,
  candyPosFromHex,
  CANDY_L_BOT,
  CANDY_L_MID,
  CANDY_L_TOP,
  CANDY_S,
  candyHue,
  hslToHex,
} from "@/lib/color-table";
import { useCallback, useEffect, useRef } from "react";

type ColorTableProps = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorTable({ value, onChange }: ColorTableProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pos = candyPosFromHex(value);

  const paint = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const cssW = Math.max(1, Math.round(wrap.clientWidth));
    const cssH = Math.max(1, Math.round(wrap.clientHeight));
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.max(1, Math.round(cssW * dpr));
    const pixelH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pixelW) canvas.width = pixelW;
    if (canvas.height !== pixelH) canvas.height = pixelH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let x = 0; x < cssW; x += 1) {
      const hue = candyHue(cssW <= 1 ? 0 : x / (cssW - 1));
      const gradient = ctx.createLinearGradient(x, 0, x, cssH);
      gradient.addColorStop(0, hslToHex(hue, CANDY_S, CANDY_L_TOP));
      gradient.addColorStop(0.5, hslToHex(hue, CANDY_S, CANDY_L_MID));
      gradient.addColorStop(1, hslToHex(hue, CANDY_S, CANDY_L_BOT));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 1, cssH);
    }
  }, []);

  useEffect(() => {
    paint();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  function pick(clientX: number, clientY: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const tx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const ty = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onChange(candyColorAt(tx, ty));
  }

  function nudge(dx: number, dy: number) {
    const nextX = Math.min(1, Math.max(0, pos.x + dx));
    const nextY = Math.min(1, Math.max(0, pos.y + dy));
    onChange(candyColorAt(nextX, nextY));
  }

  return (
    <div
      ref={wrapRef}
      role="slider"
      tabIndex={0}
      aria-label="Activity color"
      aria-valuetext={value}
      className="relative mt-2 h-24 w-full max-w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-[rgba(28,22,16,0.12)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        pick(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.08 : 0.02;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudge(-step, 0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nudge(step, 0);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          nudge(0, -step);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          nudge(0, step);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
      <div
        aria-hidden
        className="pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(28,22,16,0.28)]"
        style={{
          left: `clamp(9px, ${pos.x * 100}%, calc(100% - 9px))`,
          top: `clamp(9px, ${pos.y * 100}%, calc(100% - 9px))`,
          backgroundColor: value,
        }}
      />
    </div>
  );
}
