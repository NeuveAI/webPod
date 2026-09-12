import { prepareDeviceSteps, preparedDeviceBuffers, type PreparedDeviceData, type DevicePreparationRequest } from './device-preparation-data';
import { drainSteps } from './sticker-computation-steps';
// The main broker is the only accounting/admission owner. This map contains
// its canonical bytes, not a second independently expiring recipe cache.
const canonical = new Map<number, PreparedDeviceData>();
self.onmessage=({data}:MessageEvent<DevicePreparationRequest>)=>{
 if(data.type==='seed'){canonical.set(data.id,data.result);self.postMessage({type:'seeded',id:data.id,recoveryId:data.recoveryId});return;}
 if(data.type==='evict'){canonical.delete(data.id);return;}
 if(data.type==='lease'){
  try{
   const source=canonical.get(data.id);if(!source)throw Error('Prepared recipe has retired');
   const result=structuredClone(source);
   data.port.postMessage({id:data.id,leaseId:data.leaseId,result},preparedDeviceBuffers(result));
   self.postMessage({type:'leased',id:data.id,leaseId:data.leaseId});
  }catch{self.postMessage({type:'lease-failed',id:data.id,leaseId:data.leaseId,error:'Prepared renderer lease failed'});}
  finally{data.port.close();}
  return;
 }
 try {
  const result=drainSteps(prepareDeviceSteps(data.form));
  canonical.set(data.id,result);
  // Main receives its own immutable wrappers/query bytes. Subsequent renderer
  // copies happen here, never by cloning a mounted Three object on main.
  const main=structuredClone(result);
  self.postMessage({id:data.id,result:main},{transfer:preparedDeviceBuffers(main)});
 }catch{self.postMessage({id:data.id,error:'Device preparation failed'});}
};
