/* Adapted from Three.js 0.185.1 BufferGeometryUtils.toCreasedNormals.
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
import { BufferAttribute, type BufferGeometry } from 'three';
/** Cooperative specialization of Three 0.185.1 toCreasedNormals for the plain,
 * non-indexed Float32 extrusion used here. Face order, quantized buckets and
 * floating point operations match the installed utility exactly. */
export function* creasePreparedNormalsSteps(geometry:BufferGeometry,angle:number):Generator<void,void,void> {
 const position=geometry.getAttribute('position');
 if(geometry.index||!(position instanceof BufferAttribute)||!(position.array instanceof Float32Array)||position.itemSize!==3||position.normalized)throw Error('Unsupported prepared normal geometry');
 const positions=position.array,vertexCount=position.count,faceCount=vertexCount/3;
 const read=(array:Float32Array|Float64Array|Int32Array,index:number):number=>{const value=array[index];if(value===undefined)throw Error('Invalid prepared normal index');return value;};
 const normals=new Float64Array(faceCount*3),creaseDot=Math.cos(angle),hashMultiplier=(1+1e-10)*1e2;
 for(let f=0;f<faceCount;f++){
  if(f%128===0)yield;
  const i=f*9;
  const ax=read(positions,i),ay=read(positions,i+1),az=read(positions,i+2),bx=read(positions,i+3),by=read(positions,i+4),bz=read(positions,i+5),cx=read(positions,i+6),cy=read(positions,i+7),cz=read(positions,i+8);
  const v1x=cx-bx,v1y=cy-by,v1z=cz-bz,v2x=ax-bx,v2y=ay-by,v2z=az-bz;
  const nx=v1y*v2z-v1z*v2y,ny=v1z*v2x-v1x*v2z,nz=v1x*v2y-v1y*v2x,inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
  normals[f*3]=nx*inv;normals[f*3+1]=ny*inv;normals[f*3+2]=nz*inv;
 }
 const ids=new Int32Array(vertexCount),quantized=new Int32Array(vertexCount*3);
 let size=1;while(size<vertexCount*2)size<<=1;
 const mask=size-1,table=new Int32Array(size);let unique=0;
 for(let i=0;i<vertexCount;i++){
  if(i%128===0)yield;
  const qx=~~(read(positions,i*3)*hashMultiplier),qy=~~(read(positions,i*3+1)*hashMultiplier),qz=~~(read(positions,i*3+2)*hashMultiplier);
  let slot=(Math.imul(qx,73856093)^Math.imul(qy,19349663)^Math.imul(qz,83492791))&mask;
  for(;;){const id=read(table,slot);if(id===0){quantized[unique*3]=qx;quantized[unique*3+1]=qy;quantized[unique*3+2]=qz;table[slot]=unique+1;ids[i]=unique++;break;}
   const q3=3*(id-1);if(read(quantized,q3)===qx&&read(quantized,q3+1)===qy&&read(quantized,q3+2)===qz){ids[i]=id-1;break;}slot=(slot+1)&mask;
  }
 }
 const offsets=new Int32Array(unique+1);
 for(let i=0;i<vertexCount;i++){if(i%128===0)yield;const id=read(ids,i)+1;offsets[id]=read(offsets,id)+1;}
 for(let i=0;i<unique;i++){if(i%128===0)yield;offsets[i+1]=read(offsets,i+1)+read(offsets,i);}
 const faces=new Int32Array(vertexCount),cursors=offsets.slice(0,unique);
 for(let f=0;f<faceCount;f++){if(f%128===0)yield;for(let n=0;n<3;n++){const id=read(ids,f*3+n),cursor=read(cursors,id);faces[cursor]=f;cursors[id]=cursor+1;}}
 const output=new Float32Array(vertexCount*3);
 for(let f=0;f<faceCount;f++){
  if(f%32===0)yield;
  const f3=f*3,nx=read(normals,f3),ny=read(normals,f3+1),nz=read(normals,f3+2);
  for(let n=0;n<3;n++){
   const i=f3+n,id=read(ids,i);let x=0,y=0,z=0;
   for(let k=read(offsets,id),end=read(offsets,id+1);k<end;k++){
    const o=3*read(faces,k),ox=read(normals,o),oy=read(normals,o+1),oz=read(normals,o+2);
    if(nx*ox+ny*oy+nz*oz>creaseDot){x+=ox;y+=oy;z+=oz;}
   }
   const inv=1/(Math.sqrt(x*x+y*y+z*z)||1);output[i*3]=x*inv;output[i*3+1]=y*inv;output[i*3+2]=z*inv;
  }
 }
 geometry.setAttribute('normal',new BufferAttribute(output,3,false));
}
