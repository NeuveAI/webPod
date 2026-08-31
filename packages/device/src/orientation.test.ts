import { describe, expect, test } from "bun:test";

import {
  isCanonicalLuminancePose,
  verificationModeForPose,
} from "./orientation";

describe("D-064 verification modes", () => {
  test("only the front and rear reference poses are canonical stop-table poses", () => {
    expect(isCanonicalLuminancePose("front")).toBe(true);
    expect(isCanonicalLuminancePose("rear")).toBe(true);
    expect(isCanonicalLuminancePose("three-quarter")).toBe(false);
    expect(isCanonicalLuminancePose("edge")).toBe(false);
    expect(isCanonicalLuminancePose("custom")).toBe(false);
  });

  test("rotated and custom poses are physical-continuity validations", () => {
    expect(verificationModeForPose("front")).toBe("canonical-luminance");
    expect(verificationModeForPose("rear")).toBe("canonical-luminance");
    expect(verificationModeForPose("three-quarter")).toBe(
      "physical-continuity",
    );
    expect(verificationModeForPose("edge")).toBe("physical-continuity");
    expect(verificationModeForPose("custom")).toBe("physical-continuity");
  });
});
