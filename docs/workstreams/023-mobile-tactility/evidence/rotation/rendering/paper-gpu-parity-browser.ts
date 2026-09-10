import { createGpuPaperGeometry, PAPER_GPU_GLSL } from '../../../../../../packages/device/src/sticker-paper-gpu';
import { createStickerPaperGeometry } from '../../../../../../packages/device/src/sticker-paper';
import type { BufferGeometry } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
if (!gl) throw Error('WebGL2 unavailable');
const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER), program = gl.createProgram();
if (!vertex || !fragment || !program) throw Error('Shader allocation failed');
gl.shaderSource(vertex,`#version 300 es
precision highp float;
in vec3 paperVertex; in vec3 paperA; in vec3 paperB; in vec3 paperC;
uniform int edge;
${PAPER_GPU_GLSL}
out vec3 shown; out vec3 shownNormal;
void main(){ shown=paperPoint(paperVertex); shownNormal=edge==1?normalize(cross(paperPoint(paperC)-paperPoint(paperB),paperPoint(paperA)-paperPoint(paperB))):paperNormal(paperVertex.xy);gl_Position=vec4(shown,1.); }`);
gl.shaderSource(fragment,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}');
for(const shader of [vertex,fragment]){gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)??'compile');gl.attachShader(program,shader);}
gl.transformFeedbackVaryings(program,['shown','shownNormal'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'link');gl.useProgram(program);
const results: {liner:boolean;curl:number;part:string;maxPosition:number;maxNormal:number}[]=[];
function run(geometry:BufferGeometry,reference:BufferGeometry,edge:boolean){
 if(!gl||!program)throw Error('context');const buffers:WebGLBuffer[]=[];const count=geometry.getAttribute('position').count;
 for(const name of ['paperVertex','paperA','paperB','paperC']){const location=gl.getAttribLocation(program,name);if(location<0)continue;const attribute=geometry.getAttribute(name);if(!attribute){gl.disableVertexAttribArray(location);gl.vertexAttrib3f(location,0,0,0);continue;}const buffer=gl.createBuffer();if(!buffer)throw Error('buffer');buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,attribute.array,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);}
 const output=gl.createBuffer(),feedback=gl.createTransformFeedback();if(!output||!feedback)throw Error('feedback');gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,count*6*4,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.uniform1i(gl.getUniformLocation(program,'edge'),edge?1:0);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,count);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);const values=new Float32Array(count*6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL feedback error');let maxPosition=0,maxNormal=0;const position=reference.getAttribute('position'),normal=reference.getAttribute('normal');for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){maxPosition=Math.max(maxPosition,Math.abs((values[i*6+axis]??0)-(position.array[i*3+axis]??0)));maxNormal=Math.max(maxNormal,Math.abs((values[i*6+3+axis]??0)-(normal.array[i*3+axis]??0)));}for(const buffer of buffers)gl.deleteBuffer(buffer);gl.deleteBuffer(output);gl.deleteTransformFeedback(feedback);return{maxPosition,maxNormal};
}
for(const liner of [false,true])for(const curl of [0,.01,.25,.5,.75,1]){const input={width:300,height:500,pixel:1,liner};const gpu=createGpuPaperGeometry(input),cpu=createStickerPaperGeometry(300,500,1,liner,curl);gl.uniform4f(gl.getUniformLocation(program,'paperSize'),300,500,1,liner?1:0);gl.uniform1f(gl.getUniformLocation(program,'paperCurl'),curl);for(const part of ['front','back','edge'] as const)results.push({liner,curl,part,...run(gpu[part],cpu[part],part==='edge')});for(const geometry of [...Object.values(gpu),...Object.values(cpu)])geometry.dispose();}
gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
const debug=gl.getExtension('WEBGL_debug_renderer_info');const result={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),results};document.body.textContent=JSON.stringify(result);Reflect.set(window,'paperGpuParity',result);
