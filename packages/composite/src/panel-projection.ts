import { Matrix4, type Matrix4Tuple } from 'three';

/** Exact installed InteractionManager projection with explicit values instead of
 * a fake renderer/HTMLTexture object. CSS dimensions never include device DPR. */
export function projectNativePanel(input: {
  readonly cameraProjection: Readonly<Matrix4Tuple>;
  readonly cameraWorld: Readonly<Matrix4Tuple>;
  readonly screenWorld: Readonly<Matrix4Tuple>;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly elementWidth: number;
  readonly elementHeight: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly screenMaxZ: number;
}): Matrix4 {
  if (![input.cssWidth, input.cssHeight, input.elementWidth, input.elementHeight, input.screenWidth, input.screenHeight].every(value => value > 0 && Number.isFinite(value))) throw new RangeError('Native panel projection requires positive finite dimensions');
  const viewport = new Matrix4().set(input.cssWidth / 2, 0, 0, input.cssWidth / 2, 0, -input.cssHeight / 2, 0, input.cssHeight / 2, 0, 0, 1, 0, 0, 0, 0, 1);
  const pixelToLocal = new Matrix4().set(input.screenWidth / input.elementWidth, 0, 0, -input.screenWidth / 2, 0, -input.screenHeight / input.elementHeight, 0, input.screenHeight / 2, 0, 0, 1, input.screenMaxZ, 0, 0, 0, 1);
  return new Matrix4().fromArray(input.cameraProjection).multiply(new Matrix4().fromArray(input.cameraWorld).invert()).multiply(new Matrix4().fromArray(input.screenWorld)).multiply(pixelToLocal).premultiply(viewport);
}
