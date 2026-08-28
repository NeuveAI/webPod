import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat } from 'three'
export type OpticalProfile = ReadonlyArray<readonly [at: number, tiltDeg: number]>
export type DeviceOpticalProfiles = { readonly bodyBlack: OpticalProfile; readonly bodyWhite: OpticalProfile; readonly wheelBlack: OpticalProfile; readonly wheelWhite: OpticalProfile; readonly selectBlack: OpticalProfile; readonly selectWhite: OpticalProfile }
const flat = (ats: ReadonlyArray<number>): OpticalProfile => ats.map((at) => [at, 0] as const)
export const DEFAULT_DEVICE_OPTICAL_PROFILES: DeviceOpticalProfiles = { bodyBlack: flat([0,.05,.19,.44,.62,.81,.93,1]), bodyWhite: flat([0,.06,.21,.47,.64,.82,.94,1]), wheelBlack: flat([0,.38,.62,1]), wheelWhite: flat([0,.38,.62,1]), selectBlack: flat([0,.34,.7,1]), selectWhite: flat([0,.34,.7,1]) }
/** Tangent-space micro-curvature. `at=0` is the visible top, `at=1` the bottom. */
export function createOpticalNormalMap(profile: OpticalProfile, height = 512): DataTexture {
  const data = new Uint8Array(height * 4)
  for (let y = 0; y < height; y += 1) { const tilt = sample(profile, 1-y/(height-1))*Math.PI/180; const o=y*4; data[o]=128; data[o+1]=Math.round(127.5+127.5*Math.sin(tilt)); data[o+2]=Math.round(127.5+127.5*Math.cos(tilt)); data[o+3]=255 }
  const texture = new DataTexture(data,1,height,RGBAFormat); texture.wrapS=ClampToEdgeWrapping; texture.wrapT=ClampToEdgeWrapping; texture.minFilter=LinearFilter; texture.magFilter=LinearFilter; texture.needsUpdate=true; return texture
}
function sample(profile: OpticalProfile, at: number): number { const first=profile[0]; if(first===undefined)return 0; if(at<=first[0])return first[1]; for(let i=1;i<profile.length;i+=1){const r=profile[i],l=profile[i-1]; if(r!==undefined&&l!==undefined&&at<=r[0]){const t=(at-l[0])/(r[0]-l[0]); return l[1]+(r[1]-l[1])*t}} return profile.at(-1)?.[1]??0 }
