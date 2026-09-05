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
  LinearMipmapLinearFilter,
  RGBAFormat,
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

export type WheelLabelMapParams = {
  /** Ring outer radius — the texture covers the disc's bounding square. */
  readonly outerR: number;
  /** §12.0's measured band, r 77–79. The legends are centred in it. */
  readonly bandInnerR: number;
  readonly bandOuterR: number;
  /** §5.3 L8: `--wheel-k-label` / `--wheel-w-label`. */
  readonly labelColor: string;
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
 * Three samples roughness from green. A red-only WebGL texture returns zero
 * there, silently turning every authored roughness into the mirror floor.
 * RGBA stores the same linear noise in RGB and keeps alpha opaque.
 */
export function createMicroNoiseRoughnessMap(
  amplitude = 0.02,
  size = 128,
  seed = 0x5eed1234,
): DataTexture {
  const random = xorshift32(seed);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.round(255 * (1 - random() * amplitude));
    data[i] = noise;
    data[i + 1] = noise;
    data[i + 2] = noise;
    data[i + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
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

/** Brushed/anodized aluminum microstructure in model-unit UVs.
 * Short correlated horizontal marks mix with fine irregular grit, avoiding
 * full-width scanlines. Color carries only finish variation, height perturbs
 * physical lighting, and linear green modulates roughness. All maps share
 * scale on the front and Select and mip-filter down at normal viewing size.
 */
export function createAluminumFinishMaps(size = 512) {
  const random = xorshift32(0x6c617373);
  const colorData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    let streak = random();
    for (let x = 0; x < size; x++) {
      streak = streak * 0.75 + random() * 0.25;
      const grain = random() * 0.3 + streak * 0.7;
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        colorData[offset + channel] = Math.round(255 * (0.9 + grain * 0.1));
        heightData[offset + channel] = Math.round(255 * grain);
        roughnessData[offset + channel] = Math.round(255 * (0.8 + grain * 0.2));
      }
      colorData[offset + 3] = heightData[offset + 3] = roughnessData[offset + 3] = 255;
    }
  }
  const texture = (data: Uint8Array) => {
    const map = new DataTexture(data, size, size, RGBAFormat);
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    map.repeat.set(1 / 256, 1 / 256);
    map.generateMipmaps = true;
    map.minFilter = LinearMipmapLinearFilter;
    map.magFilter = LinearFilter;
    map.needsUpdate = true;
    return map;
  };
  const color = texture(colorData);
  color.colorSpace = SRGBColorSpace;
  const height = texture(heightData);
  const roughness = texture(roughnessData);
  return { color, height, roughness, dispose() { color.dispose(); height.dispose(); roughness.dispose(); } };
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
