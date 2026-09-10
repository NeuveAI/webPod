import { createStickerPaperGeometry } from '../../../../../../packages/device/src/sticker-paper';
import { sampleGpuPaperBounds } from '../../../../../../packages/device/src/sticker-paper-gpu';
const failures:unknown[]=[];let count=0;
for(const width of [32,95.3,300,887])for(const height of [48,200.1,500])for(const pixel of [.1,1,4])for(const liner of [true,false])for(const curl of [0,.001,.01,.25,.5,.75,1]){
 const stock=createStickerPaperGeometry(width,height,pixel,liner,curl), bounds=sampleGpuPaperBounds({width,height,pixel,liner},curl);
 for(const part of ['front','back','edge'] as const){stock[part].computeBoundingBox();if(JSON.stringify(stock[part].boundingBox)!==JSON.stringify(bounds[part]))failures.push({width,height,pixel,liner,curl,part,expected:stock[part].boundingBox,actual:bounds[part]});stock[part].dispose();count++;}
}
await Bun.write(new URL('./paper-bounds-parity.json',import.meta.url),JSON.stringify({count,failures},null,2));console.log({count,failures:failures.length,first:failures[0]});
