export type CalibrationStage =
  | "room"
  | "front"
  | "body-black"
  | "body-white"
  | "select-black"
  | "select-white"
  | "wheel-black"
  | "wheel-white"
  | "all";

const PREFIXES: Readonly<Record<CalibrationStage, ReadonlyArray<string>>> = {
  room: ["envRoom.", "cameraDistance"],
  front: ["lightRig.", "materials.", "opticalProfiles.", "form."],
  "body-black": ["materials.bodyBlack.", "opticalProfiles.bodyBlack"],
  "body-white": ["materials.bodyWhite.", "opticalProfiles.bodyWhite"],
  "select-black": ["materials.selectBlack.", "opticalProfiles.selectBlack."],
  "select-white": ["materials.selectWhite.", "opticalProfiles.selectWhite."],
  "wheel-black": ["materials.wheelRingBlack.", "opticalProfiles.wheelBlack."],
  "wheel-white": ["materials.wheelRingWhite.", "opticalProfiles.wheelWhite."],
  all: [""],
};

export function stageOwnsPath(stage: CalibrationStage, path: string): boolean {
  return PREFIXES[stage].some((prefix) => path.startsWith(prefix));
}

export function ownedPatch(
  stage: CalibrationStage,
  values: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) => stageOwnsPath(stage, path)),
  );
}

export function mergeOwned(
  stage: CalibrationStage,
  frozen: Readonly<Record<string, number>>,
  candidate: Readonly<Record<string, number>>,
): Record<string, number> {
  const merged = { ...frozen };
  for (const [path, value] of Object.entries(ownedPatch(stage, candidate))) {
    merged[path] = value;
  }
  return merged;
}
