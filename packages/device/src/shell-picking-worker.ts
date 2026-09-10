import { buildShellPickingIndex, type ShellPickingInput } from './shell-picking-index';
self.onmessage = (event: MessageEvent<ShellPickingInput>) => {
  try {
    const index = buildShellPickingIndex(event.data);
    self.postMessage({ index }, { transfer: [index.indices.buffer, index.faces.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Shell picking preparation failed' });
  }
};
