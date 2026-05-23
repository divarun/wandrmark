"use client";
import { useRef, useState, useCallback, useEffect } from "react";

const OVERSCAN = 5;

export interface VirtualizerResult {
  containerRef: React.RefObject<HTMLDivElement>;
  startIdx: number;
  endIdx: number;
  topPadding: number;
  bottomPadding: number;
}

export function useVirtualizer(count: number, itemHeight: number): VirtualizerResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 30) });

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, clientHeight } = el;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
    const end = Math.min(count, Math.ceil((scrollTop + clientHeight) / itemHeight) + OVERSCAN);
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [count, itemHeight]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => {
      el.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, measure]);

  // Re-measure when count changes (filter toggles, new POI load)
  useEffect(() => { measure(); }, [count, measure]);

  return {
    containerRef,
    startIdx: range.start,
    endIdx: range.end,
    topPadding: range.start * itemHeight,
    bottomPadding: Math.max(0, (count - range.end) * itemHeight),
  };
}
