import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement } from "react";
import { Group, PointLight, Vector3 } from "three";

import { DEFAULT_LIGHT_RIG } from "./light-rig";
import {
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
  const keyElement = requireElement<LightElementProps>(children[0], "pointLight");
  const fillElement = requireElement<LightElementProps>(
    children[1],
    "pointLight",
  );
  const modelElement = requireElement<GroupElementProps>(children[2], "group");

  const root = new Group();
  const key = new PointLight();
  key.name = keyElement.props.name;
  key.position.fromArray(keyElement.props.position);
  const fill = new PointLight();
  fill.name = fillElement.props.name;
  fill.position.fromArray(fillElement.props.position);
  const model = new Group();
  model.name = modelElement.props.name;
  model.rotation.fromArray([...modelElement.props.rotation, "XYZ"]);
  root.add(key, fill, model);
  root.updateWorldMatrix(true, true);
  return { key, fill, model };
}

describe("viewer-lit device scene frame", () => {
  test("keeps key and fill world positions invariant when only the model flips", () => {
    const front = worldFrame("front");
    const back = worldFrame("back");
    const position = new Vector3();

    expect(front.key.getWorldPosition(position).toArray()).toEqual(
      back.key.getWorldPosition(new Vector3()).toArray(),
    );
    expect(front.fill.getWorldPosition(position).toArray()).toEqual(
      back.fill.getWorldPosition(new Vector3()).toArray(),
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
    const frontKey = requireElement<LightElementProps>(frontChildren[0], "pointLight");
    const edgeKey = requireElement<LightElementProps>(edgeChildren[0], "pointLight");
    const edgeModel = requireElement<GroupElementProps>(edgeChildren[2], "group");

    expect(frontKey.props.position).toEqual(edgeKey.props.position);
    expect(edgeModel.props.rotation[1]).toBeCloseTo(-Math.PI / 2, 8);
  });
});
