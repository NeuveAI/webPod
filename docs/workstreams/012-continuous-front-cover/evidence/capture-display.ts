import { chromium, expect } from '../../../../packages/panel/node_modules/@playwright/test/index.mjs';
import { installDeterministicAppleMusic } from '../../../../apps/web/tests/deterministic-apple-music.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder=resolve(import.meta.dirname,process.argv[2]??'candidate');await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']});
const page=await browser.newPage({viewport:{width:1024,height:1100},deviceScaleFactor:2});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
for(const colourway of ['black','white']){
 await installDeterministicAppleMusic(page,{trackTitle:'A.I.R.',trackCount:4});await page.goto(`http://localhost:3000/_spike/device?capture=&colourway=${colourway}`);
 const panel=page.locator('.wp-panel');await expect(panel).toHaveAttribute('data-screen','S03');await panel.focus();await panel.press('Enter');await expect(panel.getByRole('listbox',{name:'Albums'})).toBeAttached();await panel.press('Enter');await expect(panel.locator('.wp-list-row')).toHaveCount(4);await panel.press('Enter');await expect(panel).toHaveAttribute('data-screen','S13');
 await page.evaluate(()=>{const m=Reflect.get(globalThis,'MusicKit').getInstance();m.playbackState=3;m.currentPlaybackTime=87;m.currentPlaybackDuration=246;m.__emit('playbackStateDidChange');m.__emit('playbackTimeDidChange');});await expect(panel.locator('.wp-now')).toHaveAttribute('data-playback-phase','ready');
 for(const [name,pitchDeg,yawDeg] of [['front',0,0],['quarter',20,-55]] as const){
  await page.evaluate(pose=>Reflect.get(window,'__webpodDevicePreview').setOrientation(pose),{pitchDeg,yawDeg,rollDeg:0});await page.waitForTimeout(750);
  await page.screenshot({path:resolve(folder,`${colourway}-${name}.png`)});
  {const rect=await panel.boundingBox();if(rect!==null){const clip={x:Math.max(0,rect.x-35),y:Math.max(0,rect.y-35),width:rect.width+70,height:rect.height+70};await page.screenshot({path:resolve(folder,`${colourway}-${name}-lcd.png`),clip});}}
 }
}
await browser.close();await writeFile(resolve(folder,'capture.json'),JSON.stringify({source:'live localhost:3000 worktree',fixture:'deterministic provider; Now Playing ready',viewport:[1024,1100],dpr:2,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));
