import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import {
  firstDevicePixelBox,
  resolveCanvasPixelRatio,
} from "./pixel-density";

type CanvasPixelDensityProps = { readonly enabled: boolean };

export function commitResolvedCanvasPixelRatio(
  setDpr: (dpr: number) => void,
  resolved: number,
): void {
  setDpr(resolved);
}

/** Keeps the WebGL drawing buffer aligned to physical pixels and page zoom. */
export function CanvasPixelDensity({ enabled }: CanvasPixelDensityProps) {
  const canvas = useThree((state) => state.gl.domElement);
  const setDpr = useThree((state) => state.setDpr);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;

    const sync = (entry?: ResizeObserverEntry): void => {
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
      commitResolvedCanvasPixelRatio(setDpr, dpr);
      invalidate();
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
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, [canvas, enabled, invalidate, setDpr]);

  return null;
}
