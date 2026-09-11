import type {NativeCarryState} from '../../composite/src/native-carry-controller';
type Owner='equipped'|'pack';
/** Hold complete replacement owners while the exact displayed source is still
 * needed. At most one candidate per source owner can await carry adoption. */
export function createNativeCarryAdoption(){
 let state:NativeCarryState={epoch:0,assemblyRevision:0,active:false,id:null,source:'pack',handoff:'none'},readyEpoch=0,disposed=false;
 const pending=new Map<Owner,(adopt:boolean)=>void>();
 const drain=(adopt:boolean)=>{const callbacks=[...pending.values()];pending.clear();for(const finish of callbacks)finish(adopt);};
 const waiting=()=>state.active&&readyEpoch!==state.epoch;
 return{
  read:()=>state,waiting,
  update(next:NativeCarryState){if(disposed||next.epoch<state.epoch)return false;const changed=next.epoch!==state.epoch;state=next;if(changed)drain(false);return true;},
  compatible(epoch:number,assemblyRevision:number){return !disposed&&state.active&&state.epoch===epoch&&state.assemblyRevision===assemblyRevision;},
  replace(owner:Owner,finish:(adopt:boolean)=>void){if(disposed){finish(false);return;}if(!waiting()){finish(true);return;}pending.get(owner)?.(false);pending.set(owner,finish);},
  adopt(epoch:number,assemblyRevision:number){if(disposed||!state.active||state.epoch!==epoch||state.assemblyRevision!==assemblyRevision)return false;readyEpoch=epoch;drain(true);return true;},
  handoff(owner:Owner){return !state.active&&state.handoff===owner;},
  dispose(){if(disposed)return;disposed=true;drain(false);},
 };
}
