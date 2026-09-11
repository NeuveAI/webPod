import type { DeviceOrientation } from './orientation';
import type { RenderCommand, RenderControlResponse, RenderPose, RenderRevealState } from './device-render-protocol';

/** One renderer generation's complete-scene authority; caller delivers commands
 * reliably and publishes only submitted, coherent pose/resource revisions. */
export interface DeviceMotionBinding {
  readonly read: () => RenderPose;
  readonly nextCommandSequence: () => number;
  readonly sendPose: (pose: RenderPose) => void;
  readonly sendCommand: (command: RenderCommand) => void;
  readonly subscribe: (listener: (response: RenderControlResponse) => void) => () => void;
}
/** The route owns this stable bridge across canvas replacement. Attachment is
 * permitted only after full resource readiness. Cleanup retires that binding;
 * a stale generation's cleanup cannot detach its replacement. */
export interface DeviceMotionIntent { readonly orientation: DeviceOrientation; readonly reveal: RenderRevealState | null }
export interface DeviceMotionAuthority {
  readonly readIntent: () => DeviceMotionIntent;
  readonly subscribeIntent: (listener: () => void) => () => void;
  readonly attach: (binding: DeviceMotionBinding) => () => void;
}
