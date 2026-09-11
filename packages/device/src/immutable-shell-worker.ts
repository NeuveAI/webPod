import { prepareDeviceSteps, preparedDeviceBuffers, type DevicePreparationRequest } from './device-preparation-data';
import { drainSteps } from './sticker-computation-steps';
self.onmessage=({data}:MessageEvent<DevicePreparationRequest>)=>{
 try {
  const result=drainSteps(prepareDeviceSteps(data.form));
  self.postMessage({id:data.id,result},{transfer:preparedDeviceBuffers(result)});
 }catch{self.postMessage({id:data.id,error:'Device preparation failed'});}
};
