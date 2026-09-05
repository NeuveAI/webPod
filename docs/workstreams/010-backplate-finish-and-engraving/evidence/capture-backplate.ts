import { chromium } from '../../../../packages/panel/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder=resolve(import.meta.dirname,process.argv[2]??'before');await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1024,height:1100},deviceScaleFactor:1});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
async function pose(pitchDeg:number,yawDeg:number){await page.evaluate(pose=>Reflect.get(window,'__webpodDevicePreview').setOrientation(pose),{pitchDeg,yawDeg,rollDeg:0});await page.waitForTimeout(450);}
const sweep=[];
for(const colourway of ['black','white']){
 await page.goto(`http://localhost:3000/_spike/device?capture=&diagnostic=production-surface&colourway=${colourway}`);await page.waitForFunction(()=>Reflect.get(window,'__webpodDevicePreview')!==undefined);
 for(const [pitch,yaw] of [[0,180],[15,145],[15,-145],[45,180],[-45,180],[20,-55]]){
  await pose(pitch,yaw);const name=`${colourway}-rear-${pitch}-${yaw}.png`;await page.screenshot({path:resolve(folder,name)});sweep.push({colourway,pitch,yaw,file:name});
 }
}
await browser.close();await writeFile(resolve(folder,'capture.json'),JSON.stringify({viewport:[1024,1100],dpr:1,source:'localhost:3000 production-surface diagnostic, physical default materials',isolation:'Identical passive PMREM diffusion-card environment in all five passes; only real emitters toggled. Blank LCD diagnostic by design; active LCD proof separately in final-display.',sweep,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));
