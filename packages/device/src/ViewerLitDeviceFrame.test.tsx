import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement } from "react";
import { Group, RectAreaLight, Vector3 } from "three";

import {
  DEFAULT_LIGHT_RIG,
  keyDescentAngleDeg,
  keyLightPosition,
  keyLightPower,
  kickLightPower,
  viewerAzimuthAngleDeg,
} from "./light-rig";
import {
  aimAreaLightAtTarget,
  DEVICE_MODEL_NAME,
  ViewerLitDeviceFrame,
} from "./ViewerLitDeviceFrame";
import {
  EDGE_DEVICE_ORIENTATION,
  FRONT_DEVICE_ORIENTATION,
  REAR_DEVICE_ORIENTATION,
} from "./orientation";

type LightElementProps = {
  readonly name: string;
  readonly position: readonly [number, number, number];
  readonly intensity: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: readonly [number, number, number];
};

type GroupElementProps = {
  readonly name: string;
  readonly rotation: readonly [number, number, number];
};

function frameChildren(face: "front" | "back") {
  const frame = ViewerLitDeviceFrame({
    orientation:
      face === "back" ? REAR_DEVICE_ORIENTATION : FRONT_DEVICE_ORIENTATION,
    lightRig: DEFAULT_LIGHT_RIG,
    children: null,
  });
  return Children.toArray(frame.props.children);
}

function requireElement<Props>(
  value: unknown,
  type: string,
): ReactElement<Props> {
  if (!isValidElement<Props>(value) || value.type !== type) {
    throw new Error(`expected ${type} scene element`);
  }
  return value;
}

function worldFrame(face: "front" | "back") {
  const children = frameChildren(face);
  const keyElement = requireElement<LightElementProps>(children[0], "rectAreaLight");
  const kickElement = requireElement<LightElementProps>(
    children[1],
    "rectAreaLight",
  );
  const modelElement = requireElement<GroupElementProps>(children[2], "group");

  const root = new Group();
  const key = new RectAreaLight();
  key.name = keyElement.props.name;
  key.position.fromArray(keyElement.props.position);
  const kick = new RectAreaLight();
  kick.name = kickElement.props.name;
  kick.position.fromArray(kickElement.props.position);
  const model = new Group();
  model.name = modelElement.props.name;
  model.rotation.fromArray([...modelElement.props.rotation, "XYZ"]);
  root.add(key, kick, model);
  root.updateWorldMatrix(true, true);
  return { key, kick, model };
}

describe("viewer-lit device scene frame", () => {
  test("keeps key and kick world positions invariant when only the model flips", () => {
    const front = worldFrame("front");
    const back = worldFrame("back");
    const position = new Vector3();

    expect(front.key.getWorldPosition(position).toArray()).toEqual(
      back.key.getWorldPosition(new Vector3()).toArray(),
    );
    expect(front.kick.getWorldPosition(position).toArray()).toEqual(
      back.kick.getWorldPosition(new Vector3()).toArray(),
    );
    expect(front.model.name).toBe(DEVICE_MODEL_NAME);
    expect(front.model.rotation.y).toBe(0);
    expect(back.model.rotation.y).toBe(Math.PI);
  });

  test("keeps the lamps world-fixed while accepting arbitrary pose rotations", () => {
    const front = ViewerLitDeviceFrame({
      orientation: FRONT_DEVICE_ORIENTATION,
      lightRig: DEFAULT_LIGHT_RIG,
      children: null,
    });
    const edge = ViewerLitDeviceFrame({
      orientation: EDGE_DEVICE_ORIENTATION,
      lightRig: DEFAULT_LIGHT_RIG,
      children: null,
    });
    const frontChildren = Children.toArray(front.props.children);
    const edgeChildren = Children.toArray(edge.props.children);
    const frontKey = requireElement<LightElementProps>(frontChildren[0], "rectAreaLight");
    const edgeKey = requireElement<LightElementProps>(edgeChildren[0], "rectAreaLight");
    const edgeModel = requireElement<GroupElementProps>(edgeChildren[2], "group");

    expect(frontKey.props.position).toEqual(edgeKey.props.position);
    expect(edgeModel.props.rotation[1]).toBeCloseTo(-Math.PI / 2, 8);
  });

  test("uses broad softbox emitters rather than point highlights", () => {
    const children = frameChildren("front");
    const key = requireElement<LightElementProps>(children[0], "rectAreaLight");
    const kick = requireElement<LightElementProps>(children[1], "rectAreaLight");
    expect(key.props.width).toBe(DEFAULT_LIGHT_RIG.key.emitter.width);
    expect(key.props.height).toBe(DEFAULT_LIGHT_RIG.key.emitter.height);
    expect(kick.props.width).toBe(DEFAULT_LIGHT_RIG.kick.emitter.width);
    expect(kick.props.height).toBe(DEFAULT_LIGHT_RIG.kick.emitter.height);
  });

  test("puts a 35–45° / 45° key at viewer front-right and a subordinate strip below", () => {
    const keyPosition = keyLightPosition(DEFAULT_LIGHT_RIG.key);
    const descent = keyDescentAngleDeg(keyPosition);
    const azimuth = viewerAzimuthAngleDeg(keyPosition);
    const frame = frameChildren("front");
    const key = requireElement<LightElementProps>(frame[0], "rectAreaLight");
    const kick = requireElement<LightElementProps>(frame[1], "rectAreaLight");

    expect(keyPosition[0]).toBeGreaterThan(0);
    expect(keyPosition[1]).toBeGreaterThan(0);
    expect(keyPosition[2]).toBeGreaterThan(0);
    expect(descent).toBeGreaterThanOrEqual(35);
    expect(descent).toBeLessThanOrEqual(45);
    expect(descent).toBeCloseTo(DEFAULT_LIGHT_RIG.key.descentDeg, 8);
    expect(azimuth).toBeGreaterThanOrEqual(40);
    expect(azimuth).toBeLessThanOrEqual(50);
    expect(azimuth).toBeCloseTo(DEFAULT_LIGHT_RIG.key.viewerAzimuthDeg, 8);
    expect(kick.props.position[1]).toBeLessThan(0);
    expect(kick.props.position[2]).toBeLessThan(0);
    expect(kick.props.height / kick.props.width).toBeGreaterThan(3);
    expect(kick.props.rotation).toEqual(
      aimAreaLightAtTarget(kick.props.position, DEFAULT_LIGHT_RIG.kick.target),
    );
    expect(kickLightPower(DEFAULT_LIGHT_RIG)).toBeLessThan(
      keyLightPower(DEFAULT_LIGHT_RIG),
    );
    expect(
      kickLightPower(DEFAULT_LIGHT_RIG) / keyLightPower(DEFAULT_LIGHT_RIG),
    ).toBe(DEFAULT_LIGHT_RIG.kick.powerRatio);
    const renderedKeyPower =
      key.props.intensity * key.props.width * key.props.height * Math.PI;
    const renderedKickPower =
      kick.props.intensity * kick.props.width * kick.props.height * Math.PI;
    expect(renderedKeyPower).toBeCloseTo(keyLightPower(DEFAULT_LIGHT_RIG), 6);
    expect(renderedKickPower / renderedKeyPower).toBeCloseTo(
      DEFAULT_LIGHT_RIG.kick.powerRatio,
      8,
    );
    expect(key.props.name).toBe("device-key-light");
    expect(kick.props.name).toBe("device-kick-light");
  });
});
