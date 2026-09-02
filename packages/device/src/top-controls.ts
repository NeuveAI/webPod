import { DEVICE_LAYOUT } from "./layout";

const TOP_EDGE_Y = DEVICE_LAYOUT.body.height / 2;

type PositionedBox = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly segments: number;
  readonly radius: number;
  readonly position: readonly [number, number, number];
};

/** One immutable source for the rendered top controls and device envelope. */
export const DEVICE_TOP_CONTROLS = Object.freeze({
  holdRecess: Object.freeze<PositionedBox>({
    width: 52,
    height: 2.2,
    depth: 15,
    segments: 4,
    radius: 2.8,
    position: Object.freeze([-96, TOP_EDGE_Y + 0.4, 0]),
  }),
  holdIndicator: Object.freeze<PositionedBox>({
    width: 36,
    height: 1.2,
    depth: 8.5,
    segments: 4,
    radius: 1.8,
    position: Object.freeze([-96, TOP_EDGE_Y + 1.35, 0]),
  }),
  holdSlider: Object.freeze<PositionedBox>({
    width: 20,
    height: 2.2,
    depth: 10,
    segments: 4,
    radius: 2.1,
    position: Object.freeze([-105, TOP_EDGE_Y + 2.15, 0]),
  }),
  headphoneRim: Object.freeze({
    majorRadius: 7.1,
    tubeRadius: 1.8,
    radialSegments: 24,
    tubularSegments: 64,
    position: Object.freeze([108, TOP_EDGE_Y + 1.45, 0] as const),
  }),
  headphoneWell: Object.freeze({
    radius: 5.8,
    height: 1.4,
    radialSegments: 64,
    position: Object.freeze([108, TOP_EDGE_Y + 1.25, 0] as const),
  }),
});

export type DeviceTopControlBounds = {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
};

/** Axis-aligned physical bounds of every non-decorative top-edge part. */
export function deviceTopControlBounds(): DeviceTopControlBounds {
  const { holdRecess, holdIndicator, holdSlider, headphoneRim, headphoneWell } =
    DEVICE_TOP_CONTROLS;
  const boxes = [holdRecess, holdIndicator, holdSlider].map((control) => ({
    min: [
      control.position[0] - control.width / 2,
      control.position[1] - control.height / 2,
      control.position[2] - control.depth / 2,
    ] as const,
    max: [
      control.position[0] + control.width / 2,
      control.position[1] + control.height / 2,
      control.position[2] + control.depth / 2,
    ] as const,
  }));
  const rimOuterRadius = headphoneRim.majorRadius + headphoneRim.tubeRadius;
  const parts = [
    ...boxes,
    {
      min: [
        headphoneRim.position[0] - rimOuterRadius,
        headphoneRim.position[1] - headphoneRim.tubeRadius,
        headphoneRim.position[2] - rimOuterRadius,
      ] as const,
      max: [
        headphoneRim.position[0] + rimOuterRadius,
        headphoneRim.position[1] + headphoneRim.tubeRadius,
        headphoneRim.position[2] + rimOuterRadius,
      ] as const,
    },
    {
      min: [
        headphoneWell.position[0] - headphoneWell.radius,
        headphoneWell.position[1] - headphoneWell.height / 2,
        headphoneWell.position[2] - headphoneWell.radius,
      ] as const,
      max: [
        headphoneWell.position[0] + headphoneWell.radius,
        headphoneWell.position[1] + headphoneWell.height / 2,
        headphoneWell.position[2] + headphoneWell.radius,
      ] as const,
    },
  ];
  return Object.freeze({
    min: Object.freeze([
      Math.min(...parts.map((part) => part.min[0])),
      Math.min(...parts.map((part) => part.min[1])),
      Math.min(...parts.map((part) => part.min[2])),
    ] as const),
    max: Object.freeze([
      Math.max(...parts.map((part) => part.max[0])),
      Math.max(...parts.map((part) => part.max[1])),
      Math.max(...parts.map((part) => part.max[2])),
    ] as const),
  });
}

export const DEFAULT_DEVICE_TOP_CONTROL_BOUNDS = deviceTopControlBounds();
