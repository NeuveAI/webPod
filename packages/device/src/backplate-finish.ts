import { CanvasTexture, ClampToEdgeWrapping, LinearFilter } from "three";
import { DEVICE_LAYOUT } from "./layout";

/** Rear-local material treatment; no albedo/lighting is painted into these maps. */
export const BACKPLATE_ENGRAVING = {
  name: "WebPod",
  badge: "CLASSIC",
  detail: "DESIGNED FOR MUSIC",
} as const;

export const BACKPLATE_FINISH = {
  faceRoughness: 0.12,
  edgeRoughness: 0.045,
  etchedRoughness: 0.34,
  bumpDepth: 0.018,
} as const;

/** Smoothly changes only the rolled perimeter's polish. UVs are rear plan XY. */
export function backplateRoughnessAt(x: number, y: number): number {
  const { width, height, cornerR } = DEVICE_LAYOUT.body;
  const qx = Math.abs(x) - (width / 2 - cornerR);
  const qy = Math.abs(y) - (height / 2 - cornerR);
  const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) - cornerR;
  const t = Math.max(0, Math.min(1, (-distance - 3) / 14));
  const smooth = t * t * (3 - 2 * t);
  return BACKPLATE_FINISH.edgeRoughness + smooth *
    (BACKPLATE_FINISH.faceRoughness - BACKPLATE_FINISH.edgeRoughness);
}

export function createBackplateFinishMaps(content: Readonly<{ name: string; badge: string; detail: string }> = BACKPLATE_ENGRAVING) {
  if (typeof document === "undefined") return null;
  const { width, height } = DEVICE_LAYOUT.body;
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 2048;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const value = Math.round(255 * backplateRoughnessAt(
        (x / canvas.width - 0.5) * width, (0.5 - y / canvas.height) * height,
      ) / BACKPLATE_FINISH.etchedRoughness);
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = value; pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value; pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  function engrave(ctx: CanvasRenderingContext2D, color: string) {
    ctx.save();
    // Viewed from -Z, the model's +X is the viewer's left. Keep the authored
    // text readable from the rear, with no separate plane or DoubleSide ink.
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(-canvas.width / width, canvas.height / height);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Restrained four-point product mark, separate from the functional wheel.
    ctx.beginPath(); ctx.moveTo(0, -83); ctx.quadraticCurveTo(3, -69, 14, -67);
    ctx.quadraticCurveTo(3, -65, 0, -51); ctx.quadraticCurveTo(-3, -65, -14, -67);
    ctx.quadraticCurveTo(-3, -69, 0, -83); ctx.fill();
    ctx.font = '24px Arial, sans-serif'; ctx.fillText(content.name, 0, -27);
    ctx.lineWidth = 0.65; ctx.beginPath(); ctx.roundRect(-29, 155, 58, 22, 4); ctx.stroke();
    ctx.font = '12px Arial, sans-serif'; ctx.fillText(content.badge, 0, 166);
    ctx.font = '4.5px Arial, sans-serif'; ctx.fillText(content.detail, 0, 193);
    ctx.restore();
  }
  engrave(context, "#FFFFFF");
  const roughnessMap = new CanvasTexture(canvas);
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = canvas.width; bumpCanvas.height = canvas.height;
  const bumpContext = bumpCanvas.getContext("2d");
  if (bumpContext === null) { roughnessMap.dispose(); return null; }
  bumpContext.fillStyle = "#FFFFFF"; bumpContext.fillRect(0, 0, canvas.width, canvas.height);
  engrave(bumpContext, "#000000");
  const bumpMap = new CanvasTexture(bumpCanvas);
  for (const texture of [roughnessMap, bumpMap]) {
    texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter; texture.anisotropy = 8;
  }
  return { roughnessMap, bumpMap, dispose() { roughnessMap.dispose(); bumpMap.dispose(); } };
}
