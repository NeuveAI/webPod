/**
 * The two textures the device needs, both generated rather than authored.
 *
 * ⚑ Neither is a painted gradient. The label map modulates **albedo** where
 * screen-printed ink physically sits on the surface, and the micro-noise map
 * modulates **roughness**, which is §12.3 recipe 8's stated implementation of
 * §10.2's banding guard ("CSS noise cannot modulate a 3D material's
 * roughness"). A texture that carried the shading would be the §10.4 failure;
 * these carry the material.
 *
 * Both require a DOM `<canvas>`, so both return `null` off the main thread or
 * during SSR and every caller treats the map as optional.
 */
import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  RedFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

export type WheelDecalBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type WheelDecalLayout = {
  readonly menu: WheelDecalBounds;
  readonly previous: WheelDecalBounds;
  readonly next: WheelDecalBounds;
  readonly playPause: {
    readonly bounds: WheelDecalBounds;
    readonly play: WheelDecalBounds;
    readonly pauseLeft: WheelDecalBounds;
    readonly pauseRight: WheelDecalBounds;
    readonly interSymbolGap: number;
  };
};

/**
 * Optical decal bounds measured against Apple's linked straight-on 5G image.
 *
 * Transport marks in that 235px source wheel occupy roughly 22×14 source
 * pixels. At webPod's 206px wheel that resolves to approximately 20×13 model
 * units. MENU keeps its established 13px weight and top-band placement.
 */
export function wheelDecalLayout(bandR: number): WheelDecalLayout {
  if (!(bandR > 0) || !Number.isFinite(bandR)) {
    throw new Error(
      `wheel decal radius must be finite and positive; got ${bandR}`,
    );
  }
  const at = (
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): WheelDecalBounds =>
    Object.freeze({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    });
  const playPauseWidth = 19.5;
  const playWidth = 8.5;
  const interSymbolGap = 3.5;
  const pauseBarWidth = 2.75;
  const pauseBarGap = 2;
  const playPauseX = -playPauseWidth / 2;
  const pauseLeftX = playPauseX + playWidth + interSymbolGap;
  const pauseRightX = pauseLeftX + pauseBarWidth + pauseBarGap;
  return Object.freeze({
    menu: at(0, -bandR, 44, 14),
    previous: at(-bandR, 0, 20, 13),
    next: at(bandR, 0, 20, 13),
    playPause: Object.freeze({
      bounds: at(0, bandR, playPauseWidth, 13),
      play: Object.freeze({
        x: playPauseX,
        y: bandR - 6.5,
        width: playWidth,
        height: 13,
      }),
      pauseLeft: Object.freeze({
        x: pauseLeftX,
        y: bandR - 6.5,
        width: pauseBarWidth,
        height: 13,
      }),
      pauseRight: Object.freeze({
        x: pauseRightX,
        y: bandR - 6.5,
        width: pauseBarWidth,
        height: 13,
      }),
      interSymbolGap,
    }),
  });
}

/** Pencil zbTc3's authored back-face composition, in native body pixels. */
export const BACK_COMPOSITION_LAYOUT = Object.freeze({
  width: 330,
  height: 552,
  inlay: Object.freeze({ x: 22, y: 150, width: 286, height: 296, radius: 14 }),
  markY: 50,
  wordmarkY: 106,
  legalY: 456,
  serialY: 473,
  liveY: 492,
});

/**
 * Etched identity and the dark Settings inlay from Pencil component zbTc3.
 *
 * This texture carries printed/etched graphics only. Transparent pixels leave
 * the real anisotropic steel visible, so reflections and rolled-edge response
 * remain products of the physical material rather than painted shading.
 */
export function createBackCompositionMap(scale = 2): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const layout = BACK_COMPOSITION_LAYOUT;
  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, layout.width, layout.height);

  const inlay = layout.inlay;
  ctx.fillStyle = "#141920";
  ctx.beginPath();
  ctx.roundRect(inlay.x, inlay.y, inlay.width, inlay.height, inlay.radius);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF66";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6D7B89";
  ctx.font = '700 22px "Inter Tight", ui-sans-serif, system-ui';
  ctx.fillText("✦", 165, layout.markY);
  ctx.font = '800 26px "Inter Tight", ui-sans-serif, system-ui';
  ctx.fillText("webPod", 165, layout.wordmarkY + 13);

  ctx.textAlign = "left";
  ctx.fillStyle = "#F1F5F9";
  ctx.font = '700 13px "Source Sans 3", ui-sans-serif, system-ui';
  ctx.fillText("Settings", inlay.x + 13, inlay.y + 20);
  ctx.textAlign = "right";
  ctx.fillStyle = "#94A3B8";
  ctx.font = '600 10px "Source Sans 3", ui-sans-serif, system-ui';
  ctx.fillText("↶  Menu", inlay.x + inlay.width - 13, inlay.y + 20);

  const rows = [
    ["◖", "Playback", "Shuffle · Repeat"],
    ["☼", "Display & Feel", "Backlight · Clicker"],
    ["✦", "Assistant", "18 controls exposed"],
    ["○", "Account", "Apple Music"],
    ["▤", "The Engraving", "124 actions this session"],
    ["ⓘ", "About", "webPod 1.0"],
  ] as const;
  for (const [index, row] of rows.entries()) {
    const y = inlay.y + 53 + index * 38;
    if (index === 2) {
      ctx.fillStyle = "#166534";
      ctx.fillRect(inlay.x + 1, y - 18, inlay.width - 2, 38);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = index === 2 ? "#4ADE80" : "#8A97A5";
    ctx.font = '600 14px "Source Sans 3", ui-sans-serif, system-ui';
    ctx.fillText(row[0], inlay.x + 13, y);
    ctx.fillStyle = index === 2 ? "#FFFFFF" : "#E2E8F0";
    ctx.font = '600 12.5px "Source Sans 3", ui-sans-serif, system-ui';
    ctx.fillText(row[1], inlay.x + 38, y - 5);
    ctx.fillStyle = index === 2 ? "#4ADE80" : "#7A8896";
    ctx.font = '400 9.5px "Source Sans 3", ui-sans-serif, system-ui';
    ctx.fillText(row[2], inlay.x + 38, y + 8);
    ctx.textAlign = "right";
    ctx.fillStyle = index === 2 ? "#FFFFFF" : "#5E6B78";
    ctx.fillText("›", inlay.x + inlay.width - 13, y);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#52606D";
  ctx.font = '400 9px "Source Sans 3", ui-sans-serif, system-ui';
  ctx.fillText(
    "Designed for the browser  ·  Plays Apple Music",
    165,
    layout.legalY,
  );
  ctx.font = '400 8.5px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText(
    "Model WP-5G  ·  320 × 240  ·  24 detents per turn",
    165,
    layout.serialY,
  );
  ctx.fillText(
    "Assistant tools exposed · 18 · Session 5C4B 9A11",
    165,
    layout.liveY,
  );

  const texture = new CanvasTexture(canvas);
  return tuneEtchedTextTexture(texture);
}

export function tuneEtchedTextTexture<
  TCanvas extends HTMLCanvasElement | OffscreenCanvas,
>(texture: CanvasTexture<TCanvas>): CanvasTexture<TCanvas> {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

export type WheelLabelMapParams = {
  /** Ring outer radius — the texture covers the disc's bounding square. */
  readonly outerR: number;
  /** §12.0's measured band, r 77–79. The legends are centred in it. */
  readonly bandInnerR: number;
  readonly bandOuterR: number;
  /** §5.3 L8: `--wheel-k-label` / `--wheel-w-label`. */
  readonly labelColor: string;
  /** The ring's own §12.3 base colour, so the map is neutral off the glyphs. */
  readonly ringColor: string;
  /** §5.3 L8: 13px on mobile, Source Sans 3 600, letter-spacing +0.14em. */
  readonly fontPx: number;
  /** Texture edge length. */
  readonly size: number;
};

/**
 * Screen-printed legends, as a transparent decal over the wheel.
 *
 * ⚑ This cannot be a multiplicative albedo map: the black-ring labels are
 * lighter than the ring, so `label / ring` exceeds one and clamps, leaving a
 * uniform white texture. The map therefore carries transparent pixels off the
 * glyphs and the ink colour on them; `Device` renders it as an unlit decal.
 */
export function createWheelLabelMap(
  params: WheelLabelMapParams,
): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const { size, outerR, bandInnerR, bandOuterR, fontPx } = params;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;

  ctx.clearRect(0, 0, size, size);

  const pxPerUnit = size / (outerR * 2);
  const bandR = ((bandInnerR + bandOuterR) / 2) * pxPerUnit;
  const centre = size / 2;
  const decal = wheelDecalLayout((bandInnerR + bandOuterR) / 2);

  ctx.fillStyle = params.labelColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${fontPx * pxPerUnit}px "Source Sans 3", ui-sans-serif, system-ui, sans-serif`;
  if ("letterSpacing" in ctx)
    ctx.letterSpacing = `${0.14 * fontPx * pxPerUnit}px`;
  ctx.fillText("MENU", centre, centre - bandR);

  // Transport glyphs are explicit vector ink, not font-dependent Unicode.
  // That gives play/pause a measurable gap and keeps every optical box stable
  // across OS/browser font stacks.
  drawSkipDecal(ctx, decal.previous, pxPerUnit, centre, "previous");
  drawSkipDecal(ctx, decal.next, pxPerUnit, centre, "next");
  drawPlayPauseDecal(ctx, decal.playPause, pxPerUnit, centre);

  const texture = new CanvasTexture(canvas);
  // ⚑ A colour map, so it must be tagged sRGB. `CanvasTexture` defaults to
  // `NoColorSpace`, which three then treats as already-linear — white survives
  // that unchanged, so the *background* of this map looks correct while the
  // glyphs come out at the wrong value. A silent, partial wrongness.
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawSkipDecal(
  ctx: CanvasRenderingContext2D,
  bounds: WheelDecalBounds,
  scale: number,
  centre: number,
  direction: "previous" | "next",
): void {
  ctx.save();
  ctx.translate(centre + (bounds.x + bounds.width / 2) * scale, centre);
  ctx.scale(scale, scale);
  const sign = direction === "next" ? 1 : -1;
  const triangleHeight = 13;
  const triangleGap = 0.5;
  const barGap = 1;
  const barWidth = 2.5;
  const triangleWidth = (bounds.width - triangleGap - barGap - barWidth) / 2;
  const occupied = bounds.width;
  const start = -occupied / 2;
  const firstCenter = start + triangleWidth / 2;
  const secondCenter = firstCenter + triangleWidth + triangleGap;
  drawTriangle(ctx, sign * firstCenter, 0, triangleWidth, triangleHeight, sign);
  drawTriangle(
    ctx,
    sign * secondCenter,
    0,
    triangleWidth,
    triangleHeight,
    sign,
  );
  const barCenter = start + occupied - barWidth / 2;
  ctx.fillRect(
    sign * barCenter - barWidth / 2,
    -triangleHeight / 2,
    barWidth,
    triangleHeight,
  );
  ctx.restore();
}

function drawPlayPauseDecal(
  ctx: CanvasRenderingContext2D,
  layout: WheelDecalLayout["playPause"],
  scale: number,
  centre: number,
): void {
  const localY = layout.bounds.y + layout.bounds.height / 2;
  ctx.save();
  ctx.translate(centre, centre + localY * scale);
  ctx.scale(scale, scale);
  drawTriangle(
    ctx,
    layout.play.x + layout.play.width / 2,
    0,
    layout.play.width,
    layout.play.height,
    1,
  );
  for (const bar of [layout.pauseLeft, layout.pauseRight]) {
    ctx.fillRect(bar.x, -bar.height / 2, bar.width, bar.height);
  }
  ctx.restore();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  direction: -1 | 1,
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  ctx.beginPath();
  ctx.moveTo(centerX + direction * halfWidth, centerY);
  ctx.lineTo(centerX - direction * halfWidth, centerY - halfHeight);
  ctx.lineTo(centerX - direction * halfWidth, centerY + halfHeight);
  ctx.closePath();
  ctx.fill();
}

/**
 * §12.3 recipe 8 / §10.2 — a 128² tiled roughness map, amplitude 0.02.
 *
 * ⚑ It perturbs **downward only**, because three multiplies `roughness` by the
 * map's green channel and the values here are ≤ 1. The mean shift is therefore
 * about 1% of the material's roughness — a hundredth of the ±4 gate — and the
 * point is the per-texel variation, not the mean.
 *
 * `RedFormat` is enough: three samples `roughnessMap.g`, and a single-channel
 * texture returns the same value on every channel.
 */
export function createMicroNoiseRoughnessMap(
  amplitude = 0.02,
  size = 128,
  seed = 0x5eed1234,
): DataTexture {
  const random = xorshift32(seed);
  const data = new Uint8Array(size * size);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(255 * (1 - random() * amplitude));
  }
  const texture = new DataTexture(data, size, size, RedFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // ⚑ `ExtrudeGeometry`'s UV generator emits **world coordinates**, not 0..1,
  // so a default repeat of 1 would tile this 128² texture once per body pixel
  // and alias into a flat grey. One tile per `size` body px is what "128²
  // tiled" in §12.3 recipe 8 means.
  texture.repeat.set(1 / size, 1 / size);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** §12.3 recipe 2 — horizontal 304-steel grain, encoded as RG direction + B strength. */
export function createSteelAnisotropyMap(size = 1024): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    // Two deterministic, horizontal-only micro-stripe frequencies. Direction
    // remains +x; only the strength breathes by at most five percent.
    const grain =
      0.95 +
      0.025 * Math.sin((y * Math.PI * 2) / 3) +
      0.025 * Math.sin((y * Math.PI * 2) / 5);
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 128;
      data[offset + 2] = Math.round(255 * grain);
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function xorshift32(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}
