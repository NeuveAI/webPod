import { chromium } from '../../../../packages/panel/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage();await page.goto('http://localhost:3000/_spike/device?capture=');
const result=await page.evaluate(async()=>{
 const {createBackplateFinishMaps}=await import('/@fs/Users/vinicius/code/webPod/packages/device/src/backplate-finish.ts');
 const maps=createBackplateFinishMaps();if(!maps)throw new Error('Missing maps');
 const r=maps.roughnessMap.image.getContext('2d').getImageData(0,0,1024,2048).data;
 const b=maps.bumpMap.image.getContext('2d').getImageData(0,0,1024,2048).data;
 let etched=0,wrong=0;for(let i=0;i<b.length;i+=4){if(b[i]===0){etched++;if(r[i+1]!==255)wrong++;}}
 const face=(1024*1024+512)*4;const edge=(1024*1024+1)*4;
 let disposed=0;for(const map of [maps.roughnessMap,maps.bumpMap])map.addEventListener('dispose',()=>disposed++);
 const properties={wrapS:maps.roughnessMap.wrapS,wrapT:maps.roughnessMap.wrapT,colorSpace:maps.roughnessMap.colorSpace};maps.dispose();
 const data={etchedPixels:etched,wrongEtchedGreen:wrong,faceGreen:r[face+1],edgeGreen:r[edge+1],blankBump:b[face],disposed,properties};
 if(!etched||wrong||disposed!==2||data.faceGreen<=data.edgeGreen||data.blankBump!==255||properties.colorSpace!=='')throw new Error(JSON.stringify(data));return data;
});await writeFile(new URL('./map-verification.json',import.meta.url),JSON.stringify(result,null,2));await browser.close();
