type SelectionSnapshot = ReadonlyArray<Range>;

function captureSelection(document: Document): SelectionSnapshot {
  const selection = document.getSelection();
  if (selection === null) return [];
  const ranges: Array<Range> = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    ranges.push(selection.getRangeAt(index).cloneRange());
  }
  return ranges;
}

function selectionMatches(document: Document, snapshot: SelectionSnapshot): boolean {
  const selection = document.getSelection();
  if (selection === null) return snapshot.length === 0;
  if (selection.rangeCount !== snapshot.length) return false;
  return snapshot.every((range, index) => {
    const current = selection.getRangeAt(index);
    return (
      current.startContainer === range.startContainer &&
      current.startOffset === range.startOffset &&
      current.endContainer === range.endContainer &&
      current.endOffset === range.endOffset
    );
  });
}

function restoreSelection(document: Document, snapshot: SelectionSnapshot): void {
  if (selectionMatches(document, snapshot)) return;
  const selection = document.getSelection();
  if (selection === null) return;
  selection.removeAllRanges();
  for (const range of snapshot) {
    if (
      range.startContainer.isConnected &&
      range.endContainer.isConnected
    ) {
      selection.addRange(range);
    }
  }
}

/**
 * Suppresses selection only while one click-wheel arc owns pointer capture.
 *
 * The pre-gesture ranges are restored if Blink creates a selection despite
 * the cancelable pointer/default guards. That preserves a deliberate
 * selection outside the device instead of indiscriminately clearing the
 * document. `touch-action` remains a static property of the physical device
 * shell because browsers resolve it before `pointerdown` dispatches.
 */
export class ScopedGestureSelection {
  private active = false;
  private snapshot: SelectionSnapshot = [];
  private previousUserSelect = "";
  private previousWebkitUserSelect = "";

  private readonly preventSelection = (event: Event): void => {
    if (this.active && event.cancelable) event.preventDefault();
  };

  private readonly restoreGestureSelection = (): void => {
    if (this.active) restoreSelection(this.document, this.snapshot);
  };

  private readonly endOnBlur = (): void => {
    this.stop();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly document: Document,
    private readonly window: Window,
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.snapshot = captureSelection(this.document);
    this.previousUserSelect = this.root.style.userSelect;
    this.previousWebkitUserSelect = this.root.style.getPropertyValue(
      "-webkit-user-select",
    );
    this.root.dataset["wpWheelGesture"] = "active";
    this.root.style.userSelect = "none";
    this.root.style.setProperty("-webkit-user-select", "none");
    this.root.addEventListener("selectstart", this.preventSelection, true);
    this.document.addEventListener(
      "selectionchange",
      this.restoreGestureSelection,
    );
    this.window.addEventListener("blur", this.endOnBlur);
    queueMicrotask(this.restoreGestureSelection);
  }

  stop(): void {
    if (!this.active) return;
    restoreSelection(this.document, this.snapshot);
    this.active = false;
    this.root.removeEventListener("selectstart", this.preventSelection, true);
    this.document.removeEventListener(
      "selectionchange",
      this.restoreGestureSelection,
    );
    this.window.removeEventListener("blur", this.endOnBlur);
    delete this.root.dataset["wpWheelGesture"];
    this.root.style.userSelect = this.previousUserSelect;
    if (this.previousWebkitUserSelect === "") {
      this.root.style.removeProperty("-webkit-user-select");
    } else {
      this.root.style.setProperty(
        "-webkit-user-select",
        this.previousWebkitUserSelect,
      );
    }
    this.snapshot = [];
  }

  dispose(): void {
    this.stop();
  }
}
