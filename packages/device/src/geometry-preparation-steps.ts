import { BufferAttribute, Matrix3, Matrix4, type BufferGeometry } from 'three';
/** Match BufferGeometry.translate exactly on the owned float attributes, in
 * bounded ranges. Three's own attribute operations preserve its numeric order. */
export function* translatePreparedGeometrySteps(geometry:BufferGeometry,x:number,y:number,z:number):Generator<void,void,void> {
 const matrix=new Matrix4().makeTranslation(x,y,z),normalMatrix=new Matrix3().getNormalMatrix(matrix);
 for(const name of ['position','normal'] as const){
  const attribute=geometry.getAttribute(name);
  if(!attribute)continue;
  if(!(attribute instanceof BufferAttribute)||!(attribute.array instanceof Float32Array)||attribute.itemSize!==3)throw Error('Unsupported prepared translation attribute');
  for(let start=0;start<attribute.array.length;start+=1536){
   const part=new BufferAttribute(attribute.array.subarray(start,start+1536),3,attribute.normalized);
   if(name==='position')part.applyMatrix4(matrix);else part.applyNormalMatrix(normalMatrix);
   yield;
  }
  attribute.needsUpdate=true;
 }
 if(geometry.getAttribute('tangent'))throw Error('Unexpected tangent on prepared shell');
 if(geometry.boundingBox!==null)geometry.computeBoundingBox();
 yield;
 if(geometry.boundingSphere!==null)geometry.computeBoundingSphere();
}
