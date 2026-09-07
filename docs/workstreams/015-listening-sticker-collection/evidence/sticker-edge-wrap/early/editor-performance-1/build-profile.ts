import {actualShell} from '../wrapped-witness-4/source-shell';
import {createStickerCollision,buildProfile} from './collision-build-profile';
const shell=actualShell(),collider=createStickerCollision(shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support'));await Bun.write(import.meta.dir+'/build-profile.json',JSON.stringify(buildProfile,null,2));console.log(buildProfile);collider.dispose();shell.dispose();
