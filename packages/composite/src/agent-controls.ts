import type { DeviceStore, InteractionPressButton } from '@webpod/state'
import type { ControlPhysicsController } from '@webpod/device'

export interface AgentWheelControls {
  press(button: InteractionPressButton, signal: AbortSignal): Promise<boolean>
}
const controls = new WeakMap<DeviceStore, Set<AgentWheelControls>>()
const physics = new WeakMap<DeviceStore, Set<ControlPhysicsController>>()
/** Mount scoped registry: ambiguous multi-device mounts cannot commandeer one another. */
export function bindAgentWheelControls(store: DeviceStore, owner: AgentWheelControls): () => void {
  const set = controls.get(store) ?? new Set<AgentWheelControls>()
  set.add(owner); controls.set(store, set)
  return () => { set.delete(owner); if (set.size === 0) controls.delete(store) }
}
export function bindAgentControlPhysics(store: DeviceStore, owner: ControlPhysicsController): () => void {
  const set = physics.get(store) ?? new Set<ControlPhysicsController>()
  set.add(owner); physics.set(store, set)
  return () => { set.delete(owner); if (set.size === 0) physics.delete(store) }
}
/** Resolves only an unambiguous mounted production controller. */
export function getAgentWheelControls(store: DeviceStore): AgentWheelControls {
  const set = controls.get(store)
  const owner = set?.values().next().value
  if (set?.size !== 1 || owner === undefined) throw new Error('The device controls are unavailable or more than one device is mounted.')
  return owner
}
export function getAgentControlPhysics(store: DeviceStore): ControlPhysicsController | null {
  const set = physics.get(store)
  return set?.size === 1 ? set.values().next().value ?? null : null
}
