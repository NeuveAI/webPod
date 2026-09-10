import {createImmutableShells} from './immutable-shells';
import {transferShell} from './immutable-shell-transfer';
import type {DeviceFormParams} from './form';
self.onmessage=({data}:MessageEvent<DeviceFormParams>)=>{
 let shells:ReturnType<typeof createImmutableShells>|undefined;
 try {
  shells=createImmutableShells(data);
  const result={front:transferShell(shells.front),back:transferShell(shells.back)};
  const buffers=Object.values(result).flatMap(geometry=>[...Object.values(geometry.attributes).map(attribute=>attribute.array.buffer),...(geometry.index?[geometry.index.buffer]:[])]);
  self.postMessage({result},{transfer:buffers});
 }catch{self.postMessage({error:'Shell preparation failed'});}
 finally{shells?.front.dispose();shells?.back.dispose();}
};
