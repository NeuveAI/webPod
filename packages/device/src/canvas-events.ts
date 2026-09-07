import { events, type ComputeFunction } from "@react-three/fiber";

/** Composited screen descendants have their own offsetX/Y coordinate origin. */
export const computeCanvasPointer: ComputeFunction = (event, state) => {
  const { left, top, width, height } = state.gl.domElement.getBoundingClientRect();
  if (
    !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) ||
    !Number.isFinite(left) || !Number.isFinite(top) ||
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
  ) {
    state.pointer.set(Number.NaN, Number.NaN);
    // Fiber 9.7 skips intersections when camera is null. Clear the previous ray
    // as well; an invalid layout must never replay an earlier valid pickup.
    Object.assign(state.raycaster, { camera: null });
    state.raycaster.ray.origin.set(Number.NaN, Number.NaN, Number.NaN);
    state.raycaster.ray.direction.set(Number.NaN, Number.NaN, Number.NaN);
    return;
  }
  state.pointer.set(
    (event.clientX - left) / width * 2 - 1,
    1 - (event.clientY - top) / height * 2,
  );
  state.raycaster.setFromCamera(state.pointer, state.camera);
};

/** Preserve Fiber's capture, connection, dispatch and update machinery. */
export const deviceCanvasEvents: typeof events = (store) => ({
  ...events(store),
  compute: computeCanvasPointer,
});
