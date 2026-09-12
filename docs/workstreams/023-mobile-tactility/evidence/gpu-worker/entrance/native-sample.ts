import {createHash} from 'node:crypto';
const path='/tmp/webpod-main-native-sample.txt';const source=await Bun.file(path).text();
if(!source.includes('(pid 39318)'))throw Error('Unexpected sample target');
const first=source.indexOf('    758 Thread_4511411'),last=source.indexOf('    758 Thread_4511423',first);if(first<0||last<=first)throw Error('Expected target main track missing');
const main=source.slice(first,last);
const output={pid:39318,thread:4511411,sha256:createHash('sha256').update(source).digest('hex'),date:'2026-09-11 19:25:41.536 +0200',samples:758,
 mainNativeCallTree:main,counts:{eventLoopMachMsgParent:757,signalTrampolineNested:657,machAbsoluteTimeNested:627,unsymbolicatedJsBranch:1},
 limitations:['Later one-second native sample, not simultaneous with the earlier trace.','Counts are nested stack samples, not additive CPU milliseconds.','ChromeMain offsets and unknown JIT addresses are not symbolized application functions.','Signal/time polling plus CPUThrottlingThread suggests throttling machinery but does not prove the runtime timeout cause.']};
await Bun.write(new URL('./native-sample.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
