import {
  AnimationMixer, Group, Mesh, Object3D, SkinnedMesh, Texture, Vector3,
  type AnimationAction, type LoadingManager,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HAND_POSES, type HandPose } from './state'

/** Rig contract v1: four named pose clips and two contact bones, any bound skin. */
export interface HandRig {
  readonly root: Group
  readonly mixer: AnimationMixer
  readonly actions: ReadonlyMap<HandPose, AnimationAction>
  readonly index: Object3D
  readonly thumb: Object3D
  readonly contact: Vector3
  dispose(): void
}

/** Release geometry/material/skeleton resources, including rejected skin loads. */
function disposeModel(root: Object3D) {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) object.skeleton.dispose()
    if (object instanceof Mesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
        material.dispose()
      }
    }
  })
  for (const texture of textures) texture.dispose()
}

/** Validate the asset before native-pointer suppression; invalid skins fail closed. */
export async function loadHandRig(url: string, manager: LoadingManager): Promise<HandRig> {
  const gltf = await new GLTFLoader(manager).loadAsync(url)
  const index = gltf.scene.getObjectByName('contact_index')
  const thumb = gltf.scene.getObjectByName('contact_thumb')
  if (!index || !thumb || HAND_POSES.some((pose) => !gltf.animations.some((clip) => clip.name === pose))) {
    disposeModel(gltf.scene)
    throw new Error('Hand skin requires v1 contact bones and idle/pinch/grab/press clips')
  }
  const mixer = new AnimationMixer(gltf.scene)
  const actions = new Map<HandPose, AnimationAction>()
  for (const pose of HAND_POSES) {
    const clip = gltf.animations.find((animation) => animation.name === pose)
    if (!clip) continue
    const action = mixer.clipAction(clip).play()
    action.setEffectiveWeight(pose === 'idle' ? 1 : 0)
    actions.set(pose, action)
  }
  return {
    root: gltf.scene, mixer, actions, index, thumb, contact: new Vector3(),
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); disposeModel(gltf.scene) },
  }
}
