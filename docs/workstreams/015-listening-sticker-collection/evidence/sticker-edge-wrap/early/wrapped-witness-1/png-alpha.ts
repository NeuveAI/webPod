import { inflateSync } from 'node:zlib';
export async function pngAlpha(path:string){
 const file=new Uint8Array(await Bun.file(path).arrayBuffer()),view=new DataView(file.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(view.getUint8(24)!==8||view.getUint8(25)!==6||view.getUint8(28)!==0)throw Error('Witness decoder accepts only noninterlaced RGBA8 PNG');
 const chunks:Uint8Array[]=[];for(let offset=8;offset<file.length;){const length=view.getUint32(offset),type=new TextDecoder().decode(file.subarray(offset+4,offset+8));if(type==='IDAT')chunks.push(file.subarray(offset+8,offset+8+length));offset+=length+12;}
 const compressed=new Uint8Array(chunks.reduce((sum,c)=>sum+c.length,0));let offset=0;for(const c of chunks){compressed.set(c,offset);offset+=c.length;}
 const bytes=inflateSync(compressed),stride=width*4,rgba=new Uint8Array(width*height*4),pixels=new Uint8Array(width*height);if(bytes.length!==(stride+1)*height)throw Error('Unexpected PNG scanline length');
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=bytes[y*(stride+1)];if(filter===undefined||filter>4)throw Error('Invalid PNG filter');for(let x=0;x<stride;x++){const i=y*stride+x,raw=bytes[y*(stride+1)+1+x]??0,a=x>=4?rgba[i-4]??0:0,b=y?rgba[i-stride]??0:0,c=y&&x>=4?rgba[i-stride-4]??0:0;rgba[i]=(raw+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}for(let x=0;x<width;x++)pixels[y*width+x]=rgba[y*stride+x*4+3]??0;}
 return{width,height,pixels,sha256:new Bun.CryptoHasher('sha256').update(file).digest('hex')};
}
