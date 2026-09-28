"use client";

import { useEffect, useRef } from "react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export function AtlasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const brandRgb = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-brand-primary-rgb")
      .trim() || "0, 181, 87";

    let width = 0;
    let height = 0;
    let spacing = 48;
    let frameId = 0;
    let lastFrameTime = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerVisible = false;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const mobile = width < 640;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75);

      spacing = mobile ? 43 : 37;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);

      const phase = reducedMotionQuery.matches ? 12 : time * 0.001;
      const scale = Math.max(width, height);
      const firstX = width * (0.16 + Math.sin(phase * 0.045) * 0.075);
      const firstY = height * (0.27 + Math.cos(phase * 0.038) * 0.09);
      const secondX = width * (0.81 + Math.cos(phase * 0.034 + 1.7) * 0.065);
      const secondY = height * (0.72 + Math.sin(phase * 0.041 + 0.9) * 0.08);
      const rows = Math.ceil(height / spacing) + 1;
      const columns = Math.ceil(width / spacing) + 1;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = column * spacing + (row % 2) * spacing * 0.34;
          const y = row * spacing;
          const firstDistance = ((x - firstX) ** 2 + (y - firstY) ** 2) / (scale * scale);
          const secondDistance = ((x - secondX) ** 2 + (y - secondY) ** 2) / (scale * scale);
          const firstField = Math.exp(-firstDistance / 0.085);
          const secondField = Math.exp(-secondDistance / 0.065);
          const wave = 0.5 + 0.5 * Math.sin(
            x * 0.009 + y * 0.006 + phase * 0.11 + Math.sin(y * 0.004 - phase * 0.052),
          );
          const field = clamp(firstField * 0.82 + secondField * 0.74 + wave * 0.2, 0, 1);
          const radiusField = field ** 1.35;

          const quietX = (x - width * 0.5) / Math.max(width * 0.34, 1);
          const quietY = (y - height * 0.46) / Math.max(height * 0.3, 1);
          const quietDistance = Math.sqrt(quietX * quietX + quietY * quietY);
          const quietFactor = 0.22 + smoothstep(0.3, 1.28, quietDistance) * 0.78;

          let pointerInfluence = 0;
          if (pointerVisible && finePointerQuery.matches && !reducedMotionQuery.matches) {
            const pointerDistance = ((x - pointerX) ** 2 + (y - pointerY) ** 2) / (165 * 165);
            pointerInfluence = Math.exp(-pointerDistance * 1.8);
          }

          const radius = clamp(0.65 + radiusField * quietFactor * 3.2 + pointerInfluence * 0.5, 0.65, 3.9);
          const opacity = 0.075 + radiusField * quietFactor * 0.125 + pointerInfluence * 0.025;

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${brandRgb}, ${opacity.toFixed(3)})`;
          context.fill();
        }
      }
    };

    const animate = (time: number) => {
      if (time - lastFrameTime >= 38) {
        draw(time);
        lastFrameTime = time;
      }
      frameId = window.requestAnimationFrame(animate);
    };

    const start = () => {
      window.cancelAnimationFrame(frameId);
      lastFrameTime = 0;
      if (reducedMotionQuery.matches || document.hidden) {
        draw(0);
      } else {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    const handleResize = () => {
      resize();
      start();
    };
    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerVisible = true;
    };
    const handlePointerLeave = () => {
      pointerVisible = false;
    };
    const handleVisibilityChange = () => start();

    resize();
    start();
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", start);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", start);
    };
  }, []);

  return (
    <div className="atlas-canvas-background" aria-hidden="true">
      <div className="atlas-gradient-field atlas-gradient-field-one" />
      <div className="atlas-gradient-field atlas-gradient-field-two" />
      <div className="atlas-gradient-field atlas-gradient-field-three" />
      <div className="atlas-gradient-field atlas-gradient-field-four" />
      <canvas ref={canvasRef} className="atlas-dot-field" />
    </div>
  );
}
