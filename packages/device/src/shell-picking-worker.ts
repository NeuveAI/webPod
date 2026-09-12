import {packedTreeBuffers} from './packed-collision-tree';
import { buildShellPickingIndex, type ShellPickingInput } from './shell-picking-index';
self.onmessage = (event: MessageEvent<{id:number;input:ShellPickingInput}>) => {
  try {
    const index = buildShellPickingIndex(event.data.input);
    self.postMessage({ id:event.data.id,index }, { transfer: [index.indices.buffer,...packedTreeBuffers(index.root)] });
  } catch (error) {
    self.postMessage({ id:event.data.id,error: error instanceof Error ? error.message : 'Shell picking preparation failed' });
  }
};
