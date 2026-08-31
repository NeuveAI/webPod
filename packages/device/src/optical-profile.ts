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
  bodyBlack: [[0,0.07712727487832405],[0.05,6.40938118768856],[0.19,-10],[0.44,-1.1593896630685778],[0.62,2.444579858481884],[0.81,-10],[0.93,7.111614411283284],[1,10]],
  bodyBlackLateral: [[0,11.125515649464727],[0.05,-5.498053253321906],[0.19,12],[0.44,3.599662756542489],[0.62,3.710748364113271],[0.81,-12],[0.93,1.156326578730345],[1,-5.371723251683265]],
  bodyBlackRoughness: [[0,0.8919865369410254],[0.25,0.32433719373430603],[0.5,0.1],[0.75,0.1655074472927919],[1,1]],
  // VWaJS is a pearl moulding, not a flat white card. These bounded normal
  // changes make the shared physical rig produce its authored top highlight,
  // mid-body trough and lower recovery without an albedo ramp.
  bodyWhite: [[0,-3.568719020420686],[0.06,-7],[0.21,-4],[0.47,-0.36104928688146165],[0.64,0.35638991348445437],[0.82,-3.6461996299587183],[0.94,0],[1,5.811169121414422]],
  bodyWhiteLateral: [[0,-12],[0.06,-2.3708073017299176],[0.21,-1.3878806587792925],[0.47,-5.970454912677408],[0.64,-7.831557113677263],[0.82,-7.834569175567478],[0.94,-12],[1,0]],
  bodyWhiteRoughness: [[0,1],[0.25,1],[0.5,0.3863774735261222],[0.75,1],[1,1]],
  wheelBlack: [[0,-12],[0.38,-7.235359379315376],[0.62,2.2841668515175577],[1,8]],
  wheelBlackLateral: flat([0, 0.38, 0.62, 1]),
  wheelWhite: [[0,0.375],[0.38,5.96875],[0.62,4.25],[1,1]],
  wheelWhiteLateral: flat([0, 0.38, 0.62, 1]),
  selectBlack: [[0,-0.5],[0.34,-2],[0.7,5],[1,2.625]],
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
