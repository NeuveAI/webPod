import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement } from "react";
import { Group, RectAreaLight, Vector3 } from "three";

import {
  areaLightIntensity,
  DEFAULT_LIGHT_RIG,
  keyDescentAngleDeg,
  keyLightPosition,
  keyLightPower,
  kickLightPosition,
  kickLightPower,
  lightRigForContribution,
  viewerAzimuthAngleDeg,
} from "./light-rig";
import {
  aimAreaLightAtTarget,
  DEVICE_CONTENT_NAME,
  DEVICE_MODEL_NAME,
  ViewerLitDeviceFrame,
} from "./ViewerLitDeviceFrame";
import { DEFAULT_DEVICE_ENVELOPE } from "./device-envelope";
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
  readonly position?: readonly [number, number, number];
  readonly scale?: readonly [number, number, number];
  readonly children?: unknown;
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
    expect(edgeModel.props.position).toBeUndefined();
    expect(edgeModel.props.scale).toBeUndefined();
  });

  test("rotates one root around the complete immutable enclosure center", () => {
    for (const orientation of [
      FRONT_DEVICE_ORIENTATION,
      EDGE_DEVICE_ORIENTATION,
      REAR_DEVICE_ORIENTATION,
      { pitchDeg: 45, yawDeg: 137, rollDeg: 18 },
    ]) {
      const frame = ViewerLitDeviceFrame({
        orientation,
        lightRig: DEFAULT_LIGHT_RIG,
        children: null,
      });
      const children = Children.toArray(frame.props.children);
      const model = requireElement<GroupElementProps>(children[2], "group");
      const content = requireElement<GroupElementProps>(
        Children.only(model.props.children),
        "group",
      );

      expect(model.props.name).toBe(DEVICE_MODEL_NAME);
      expect(model.props.position).toBeUndefined();
      expect(model.props.scale).toBeUndefined();
      expect(content.props.name).toBe(DEVICE_CONTENT_NAME);
      expect(content.props.position).toEqual([
        -DEFAULT_DEVICE_ENVELOPE.center[0],
        -DEFAULT_DEVICE_ENVELOPE.center[1],
        -DEFAULT_DEVICE_ENVELOPE.center[2],
      ]);
    }
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

  test("puts the approved key front-right and the broad subordinate fill front-left below", () => {
    const keyPosition = keyLightPosition(DEFAULT_LIGHT_RIG.key);
    const kickPosition = kickLightPosition(DEFAULT_LIGHT_RIG.kick);
    const descent = keyDescentAngleDeg(keyPosition);
    const azimuth = viewerAzimuthAngleDeg(keyPosition);
    const kickElevation = keyDescentAngleDeg(kickPosition);
    const kickAzimuth = viewerAzimuthAngleDeg(kickPosition);
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
    expect(kick.props.position[0]).toBeLessThan(0);
    expect(kick.props.position[1]).toBeLessThan(0);
    expect(kick.props.position[2]).toBeGreaterThan(0);
    expect(kickElevation).toBeCloseTo(-18, 8);
    expect(kickAzimuth).toBeCloseTo(-45, 8);
    expect(kick.props.width).toBeGreaterThan(key.props.width);
    expect(kick.props.width * kick.props.height).toBeGreaterThan(
      key.props.width * key.props.height,
    );
    expect(kick.props.width / kick.props.height).toBeLessThan(1.6);
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

  test("keeps the broad fill soft and subordinate instead of making a hotspot or band", () => {
    const keyIntensity = areaLightIntensity(
      keyLightPower(DEFAULT_LIGHT_RIG),
      DEFAULT_LIGHT_RIG.key.emitter,
    );
    const fillIntensity = areaLightIntensity(
      kickLightPower(DEFAULT_LIGHT_RIG),
      DEFAULT_LIGHT_RIG.kick.emitter,
    );

    expect(DEFAULT_LIGHT_RIG.kick.powerRatio).toBeLessThan(0.1);
    expect(fillIntensity / keyIntensity).toBeLessThan(0.08);
    expect(DEFAULT_LIGHT_RIG.kick.emitter.width).toBeGreaterThan(330);
    expect(DEFAULT_LIGHT_RIG.kick.emitter.height).toBeGreaterThan(330);
    expect(DEFAULT_LIGHT_RIG.kick.emitter).not.toEqual({ width: 85, height: 300 });
    expect(DEFAULT_LIGHT_RIG.kick.viewerAzimuthDeg).not.toBe(-120);
  });

  test("isolates key and fill for proof without moving either emitter", () => {
    const combined = lightRigForContribution(DEFAULT_LIGHT_RIG, "combined");
    const keyOnly = lightRigForContribution(DEFAULT_LIGHT_RIG, "key-only");
    const fillOnly = lightRigForContribution(DEFAULT_LIGHT_RIG, "fill-only");

    expect(keyLightPower(combined)).toBeGreaterThan(0);
    expect(kickLightPower(combined)).toBeGreaterThan(0);
    expect(keyLightPower(keyOnly)).toBeGreaterThan(0);
    expect(kickLightPower(keyOnly)).toBe(0);
    expect(keyLightPower(fillOnly)).toBe(0);
    expect(kickLightPower(fillOnly)).toBeGreaterThan(0);
    expect(keyLightPosition(keyOnly.key)).toEqual(keyLightPosition(combined.key));
    expect(kickLightPosition(fillOnly.kick)).toEqual(
      kickLightPosition(combined.kick),
    );
    expect(areaLightIntensity(0, DEFAULT_LIGHT_RIG.key.emitter)).toBe(0);
    expect(() => areaLightIntensity(-1, DEFAULT_LIGHT_RIG.key.emitter)).toThrow(
      "area-light power must be non-negative",
    );
  });

  test("contains no view-locked, UV, ambient, or painted-light escape", async () => {
    const frameSource = await Bun.file(
      new URL("./ViewerLitDeviceFrame.tsx", import.meta.url),
    ).text();
    const rigSource = await Bun.file(new URL("./light-rig.ts", import.meta.url)).text();
    const source = `${frameSource}\n${rigSource}`;

    expect(frameSource.match(/<rectAreaLight/g)).toHaveLength(2);
    expect(source).not.toMatch(
      /<pointLight|<spotLight|<directionalLight|<ambientLight|camera(?:Position|Direction)|viewMatrix|vUv|outgoingLight|linear-gradient|radial-gradient/,
    );
  });
});
