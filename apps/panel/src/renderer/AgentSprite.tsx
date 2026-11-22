import { useEffect, useRef } from 'react';
import { drawSprite, SPRITE_H, SPRITE_W } from './sprite/scene';

type Props = {
  pose: string;
  color: string;
  subagentCount?: number;
  className?: string;
};

/** Lienzo 56×66 = Nuevo-Sprite legacy. */
export function AgentSprite({ pose, color, subagentCount = 2, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(pose);
  const colorRef = useRef(color);
  const countRef = useRef(subagentCount);
  poseRef.current = pose;
  colorRef.current = color;
  countRef.current = subagentCount;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SPRITE_W * dpr);
    canvas.height = Math.round(SPRITE_H * dpr);
    canvas.style.width = `${SPRITE_W}px`;
    canvas.style.height = `${SPRITE_H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= 80) {
        frame += 0.35;
        last = now;
        drawSprite(
          ctx,
          poseRef.current,
          colorRef.current,
          frame,
          countRef.current,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    drawSprite(ctx, pose, color, 0, subagentCount);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      width={SPRITE_W}
      height={SPRITE_H}
      aria-hidden
    />
  );
}
