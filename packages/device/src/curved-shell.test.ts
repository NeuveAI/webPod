import { describe, expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry } from "three";

import { applyVerticalCrown, verticalCrownOffset } from "./curved-shell";

describe("vertical shell crown", () => {
  test("is one smooth macro curve with fixed top and bottom joins", () => {
    expect(verticalCrownOffset(-100, 100, 12)).toBe(0);
    expect(verticalCrownOffset(0, 100, 12)).toBe(12);
    expect(verticalCrownOffset(100, 100, 12)).toBe(0);
    expect(verticalCrownOffset(-50, 100, 12)).toBe(9);
    expect(verticalCrownOffset(50, 100, 12)).toBe(9);
  });

  test("deforms positions rather than encoding grading rows", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-1, -100, 2, 1, 0, 2, -1, 100, 2]),
        3,
      ),
    );
    geometry.setIndex([0, 1, 2]);

    applyVerticalCrown(geometry, 100, 12);

    const position = geometry.getAttribute("position");
    expect(position.getZ(0)).toBe(2);
    expect(position.getZ(1)).toBe(14);
    expect(position.getZ(2)).toBe(2);
    geometry.dispose();
  });
});
