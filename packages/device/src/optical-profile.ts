import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  type BufferGeometry,
  Vector3,
} from "three";
export type OpticalProfile = ReadonlyArray<
  readonly [at: number, tiltDeg: number]
>;
export type DeviceOpticalProfiles = {
  readonly bodyBlack: OpticalProfile;
  readonly bodyBlackLateral: OpticalProfile;
  readonly bodyBlackRoughness: OpticalProfile;
  readonly bodyWhite: OpticalProfile;
  readonly bodyWhiteLateral: OpticalProfile;
  readonly bodyWhiteRoughness: OpticalProfile;
  readonly wheelBlack: OpticalProfile;
  readonly wheelBlackLateral: OpticalProfile;
  readonly wheelWhite: OpticalProfile;
  readonly wheelWhiteLateral: OpticalProfile;
  readonly selectBlack: OpticalProfile;
  readonly selectBlackLateral: OpticalProfile;
  readonly selectWhite: OpticalProfile;
  readonly selectWhiteLateral: OpticalProfile;
};
const flat = (ats: ReadonlyArray<number>): OpticalProfile =>
  ats.map((at) => [at, 0] as const);
export const DEFAULT_DEVICE_OPTICAL_PROFILES: DeviceOpticalProfiles = {
  bodyBlack: [[0,0.9],[0.05,5.2],[0.19,-8.4],[0.44,-0.8],[0.62,2.1],[0.81,-6.3],[0.93,5.1],[1,8.5]],
  bodyBlackLateral: [[0,8.6],[0.05,-1],[0.19,5.2],[0.44,3.1],[0.62,3.2],[0.81,-7.4],[0.93,0.7],[1,-1.5]],
  bodyBlackRoughness: [[0,0.9],[0.25,0.68],[0.5,0.26],[0.75,0.56],[1,0.94]],
  // VWaJS is a pearl moulding, not a flat white card. These bounded normal
  // changes make the shared physical rig produce its authored top highlight,
  // mid-body trough and lower recovery without an albedo ramp.
  bodyWhite: [[0,-2.2],[0.06,-4.4],[0.21,-3],[0.47,-0.25],[0.64,0.22],[0.82,-2],[0.94,0],[1,3.6]],
  bodyWhiteLateral: [[0,-8.2],[0.06,-2],[0.21,-1.1],[0.47,-4],[0.64,-5.1],[0.82,-4.8],[0.94,-7.2],[1,0]],
  bodyWhiteRoughness: [[0,0.95],[0.25,0.91],[0.5,0.58],[0.75,0.84],[1,0.94]],
  wheelBlack: [[0,-8.921],[0.38,-5.676],[0.62,1.9704],[1,8.2946]],
  wheelBlackLateral: flat([0, 0.38, 0.62, 1]),
  wheelWhite: [[0,0.375],[0.38,5.96875],[0.62,4.25],[1,1]],
  wheelWhiteLateral: flat([0, 0.38, 0.62, 1]),
  selectBlack: [[0,2.8464],[0.34,-0.2635],[0.7,6.5695],[1,4.0584]],
  selectBlackLateral: flat([0, 0.34, 0.7, 1]),
  selectWhite: [[0,5.649757668912411],[0.34,-2.1739468299597497],[0.7,-7.586523023024202],[1,-1.845465837329626]],
  selectWhiteLateral: flat([0, 0.34, 0.7, 1]),
};
/** Tangent-space micro-curvature. `at=0` is the visible top, `at=1` the bottom. */
export function createOpticalNormalMap(
  profile: OpticalProfile,
  height = 512,
  lateral?: OpticalProfile,
): DataTexture {
  const data = new Uint8Array(height * 4);
  for (let y = 0; y < height; y += 1) {
    const at = 1 - y / (height - 1);
    const tilt = (sample(profile, at) * Math.PI) / 180;
    const side = (sample(lateral ?? [], at) * Math.PI) / 180;
    const nx = Math.sin(side),
      ny = Math.sin(tilt),
      nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const o = y * 4;
    data[o] = Math.round(127.5 + 127.5 * nx);
    data[o + 1] = Math.round(127.5 + 127.5 * ny);
    data[o + 2] = Math.round(127.5 + 127.5 * nz);
    data[o + 3] = 255;
  }
  const texture = new DataTexture(data, 1, height, RGBAFormat);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Three reads roughness from green; RGBA avoids the old RedFormat no-op. */
export function createBodyRoughnessMap(
  profile: OpticalProfile,
  width = 128,
  height = 512,
): DataTexture {
  let state = 0x5eed1234;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const factor = Math.max(0, Math.min(1, sample(profile, 1 - y / (height - 1))));
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const roughness = factor * (1 - random() * 0.02);
      data[offset] = 255; data[offset + 1] = Math.round(255 * roughness);
      data[offset + 2] = 255; data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter; texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function sample(profile: OpticalProfile, at: number): number {
  const first = profile[0];
  if (first === undefined) return 0;
  if (at <= first[0]) return first[1];
  for (let i = 1; i < profile.length; i += 1) {
    const r = profile[i],
      l = profile[i - 1];
    if (r !== undefined && l !== undefined && at <= r[0]) {
      const t = (at - l[0]) / (r[0] - l[0]);
      return l[1] + (r[1] - l[1]) * t;
    }
  }
  return profile.at(-1)?.[1] ?? 0;
}

export function applyOpticalProfile(
  geometry: BufferGeometry,
  vertical: OpticalProfile,
  lateral: OpticalProfile,
  minY: number,
  maxY: number,
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  for (let index = 0; index < normal.count; index += 1) {
    if (normal.getZ(index) <= 0) continue;
    const at = 1 - (position.getY(index) - minY) / (maxY - minY);
    const x = (sample(lateral, at) * Math.PI) / 180;
    const y = (sample(vertical, at) * Math.PI) / 180;
    const nx = Math.sin(x);
    const ny = Math.sin(y);
    const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny));
    normal.setXYZ(index, nx, ny, nz);
  }
  normal.needsUpdate = true;
  return geometry;
}

/** Rotate live tessellated normals without flattening the authored crown. */
export function addOpticalProfile(
  geometry: BufferGeometry,
  vertical: OpticalProfile,
  lateral: OpticalProfile,
  minY: number,
  maxY: number,
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const value = new Vector3();
  const xAxis = new Vector3(1, 0, 0);
  const yAxis = new Vector3(0, 1, 0);
  for (let index = 0; index < normal.count; index += 1) {
    if (normal.getZ(index) <= 0) continue;
    const at = 1 - (position.getY(index) - minY) / (maxY - minY);
    value.set(normal.getX(index), normal.getY(index), normal.getZ(index))
      .applyAxisAngle(xAxis, (-sample(vertical, at) * Math.PI) / 180)
      .applyAxisAngle(yAxis, (sample(lateral, at) * Math.PI) / 180)
      .normalize();
    normal.setXYZ(index, value.x, value.y, value.z);
  }
  normal.needsUpdate = true;
  return geometry;
}
