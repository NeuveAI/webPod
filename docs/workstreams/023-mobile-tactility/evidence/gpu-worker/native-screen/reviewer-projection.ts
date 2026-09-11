import assert from 'node:assert/strict';
import { GlobalRegistrator } from '../../../../../../packages/device/node_modules/@happy-dom/global-registrator';
import { Euler, HTMLTexture, Mesh, MeshBasicMaterial, PlaneGeometry, PerspectiveCamera } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { InteractionManager } from '../../../../../../packages/device/node_modules/three/examples/jsm/interaction/InteractionManager.js';
import { projectNativePanel } from '../../../../../../packages/composite/src/panel-projection';
import { fitPanelContentToFrame } from '../../../../../../packages/composite/src/html-in-canvas';
GlobalRegistrator.register();
let comparisons=0;
try {
  for(const [width,height] of [[440,956],[1280,720]]) for(const yaw of [-2,-.5,0,.7,2]) for(const z of [0,3]) {
    const canvas=document.createElement('canvas'), panel=document.createElement('div'), content=document.createElement('div'); panel.append(content);
    Object.defineProperties(canvas,{clientWidth:{value:width},clientHeight:{value:height}});
    Object.defineProperties(panel,{offsetWidth:{value:320},offsetHeight:{value:240}});
    Object.defineProperties(content,{offsetWidth:{value:272},offsetHeight:{value:204}});
    fitPanelContentToFrame(panel,320,240); assert.equal(content.style.transform,'scale(1.1764705882352942, 1.1764705882352942)');
    const texture=new HTMLTexture(panel), geometry=new PlaneGeometry(272,204); geometry.translate(0,0,z); geometry.computeBoundingBox();
    const material=new MeshBasicMaterial({map:texture}), mesh=new Mesh(geometry,material);
    mesh.matrixWorld.makeRotationFromEuler(new Euler(.3,yaw,-.1)).setPosition(3,-8,4);
    const camera=new PerspectiveCamera(32,width/height,1,4000); camera.position.set(14,25,900); camera.lookAt(0,0,0); camera.updateMatrixWorld();
    const manager=new InteractionManager(); manager.element=canvas; manager.camera=camera; manager.add(mesh); manager.update();
    const reference=panel.style.transform.slice('matrix3d('.length,-1).split(',').map(Number);
    const actual=projectNativePanel({cameraProjection:camera.projectionMatrix.toArray(),cameraWorld:camera.matrixWorld.toArray(),screenWorld:mesh.matrixWorld.toArray(),cssWidth:width,cssHeight:height,elementWidth:320,elementHeight:240,screenWidth:272,screenHeight:204,screenMaxZ:z});
    assert.deepEqual(actual.elements,reference); comparisons++;
    manager.disconnect(); geometry.dispose(); material.dispose(); texture.dispose();
  }
  console.log(JSON.stringify({installedThree:'0.185.1',actualInteractionManager:true,exactMatrixComparisons:comparisons,sharedPanelFit:true,scope:'Actual installed projection implementation with controlled DOM dimensions; no physical compositor or input timing claim.'},null,2));
} finally {GlobalRegistrator.unregister();}
