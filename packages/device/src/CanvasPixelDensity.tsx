import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import {
  firstDevicePixelBox,
  resolveCanvasPixelRatio,
} from "./pixel-density";

type CanvasPixelDensityProps = {
  readonly enabled: boolean;
  readonly onChange: (density: number) => void;
};

export function commitResolvedCanvasPixelRatio(
  setDpr: (dpr: number) => void,
  resolved: number,
): void {
  setDpr(resolved);
}

/** Keeps the WebGL drawing buffer aligned to physical pixels and page zoom. */
export function CanvasPixelDensity({ enabled, onChange }: CanvasPixelDensityProps) {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    let disposed = false;

    const sync = (entry?: ResizeObserverEntry): void => {
      if (disposed) return;
      const rect = entry?.contentRect ?? canvas.getBoundingClientRect();
      const dpr = resolveCanvasPixelRatio({
        cssWidth: rect.width,
        cssHeight: rect.height,
        devicePixelBox: firstDevicePixelBox(entry?.devicePixelContentBoxSize),
        fallbackDevicePixelRatio: window.devicePixelRatio,
      });
      // The physical-box resolver has already clamped and resolved this
      // number. Passing a range asks R3F to resolve it again against
      // window.devicePixelRatio and loses fractional browser-zoom density.
      commitResolvedCanvasPixelRatio(onChange, dpr);
    };

    const observer = new ResizeObserver((entries) => sync(entries[0]));
    const supportsPhysicalBox =
      typeof ResizeObserverEntry !== "undefined" &&
      "devicePixelContentBoxSize" in ResizeObserverEntry.prototype;
    observer.observe(
      canvas,
      supportsPhysicalBox ? { box: "device-pixel-content-box" } : undefined,
    );
    sync();

    const onViewportResize = (): void => sync();
    window.visualViewport?.addEventListener("resize", onViewportResize);
    return () => {
      disposed = true;
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, [canvas, enabled, onChange]);

  return null;
}
