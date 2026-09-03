/** Marks a ray-confirmed wheel control without implying device movement. */
export function setDeviceControlCursor(canvas: HTMLCanvasElement, interactive: boolean): void {
  if (interactive) canvas.dataset["wpCursorControl"] = "true";
  else delete canvas.dataset["wpCursorControl"];
}
