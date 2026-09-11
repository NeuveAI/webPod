# Explicit glass environment semantics — independent source investigation

The installed Three 0.185.1 source rules out the proposed extra scene-intensity multiplier for the explicit glass PMREM. It does not establish equal generated PMREM texels or identify the visual gap's cause. This was a bounded read-only inspection; no renderer settings or application source were changed.

All Three paths below are relative to `node_modules/.bun/three@0.185.1/node_modules/three/src/`.

| Boundary | Installed source evidence | Result for the observed glass |
|---|---|---|
| GL intensity | `renderers/webgl/WebGLMaterials.js:407` loads material.envMapIntensity; `renderers/WebGLRenderer.js:2694` substitutes scene.environmentIntensity only when material.envMap is null | Explicit screen map uses 1.1, not 1.1 × .2 |
| Node intensity | `nodes/accessors/MaterialProperties.js:21` returns material.envMap ? material.envMapIntensity : scene.environmentIntensity; `nodes/lighting/EnvironmentNode.js:79` and :97 multiply that value into radiance and clearcoat radiance | Same explicit-map 1.1; no additional scene .2 factor in this path |
| Rotation | GL `WebGLRenderer.js:2178`, `webgl/WebGLMaterials.js:245`; Node `MaterialProperties.js:41` | Both choose the material Euler for an explicit map and transpose its rotation matrix. Scene environment rotation is not substituted |
| PMREM coordinates | Node `nodes/pmrem/PMREMNode.js:345` explicitly flips Y for render-target PMREM; GL's extra cube-texture transform at `WebGLMaterials.js:248` applies only to non-render-target cube textures | The node Y flip is documented compensation for its generator, not evidence of an accidental user rotation. The explicit map is generated CubeUV, not a source cube texture |
| PMREM defaults | GL `extras/PMREMGenerator.js:109`; Node `renderers/common/extras/PMREMGenerator.js:137` | Both fromScene defaults: sigma0, near.1, far100, size256, origin. App callers supply the same authored sigma and dedicated screen room |
| Storage | GL `extras/PMREMGenerator.js:297`; Node `renderers/common/extras/PMREMGenerator.js:905` | HalfFloat, RGBA, LinearSRGB, CubeUV mapping in both |
| Capture tone mapping | GL generator explicitly sets NoToneMapping at :347; Node renderer `renderers/common/Renderer.js:2502` returns NoToneMapping for non-output targets | Absence of a local Node generator toneMapping assignment does not establish AgX baked into that PMREM |
| Roughness sampling | GL `renderers/shaders/ShaderChunk/cube_uv_reflection_fragment.glsl.js:132`; Node `nodes/pmrem/PMREMUtils.js:110` | Same piecewise roughness-to-mip formula, including -2 × log2(1.16 × roughness), rather than an evident different roughness default |

The live application supplies the explicit map through `physical-material-nodes.ts:73` and retains stock physical environment lighting through its custom lighting subclass. GL `StudioEnvironment.tsx:83–88` and native `render-backend-services.ts` both generate the body and separate screen maps from `createProductStudioEnvironment`, with the screen flag true for glass. Their generation implementations remain different renderer code paths. Matching settings and formulas cannot certify their sampled radiance, convolution, floating-point results or final physical lighting output.

Conclusion: do not compensate by multiplying/dividing glass intensity by .2 or removing the Node generator's Y correction on this evidence. No source-bound mismatch was found in these specific intensity, rotation, storage, tone-map-selection or roughness-selection semantics. The before-glass sampler's constant GL grid remains a separate unresolved diagnostic equivalence issue; its flat-field equality alone does not prove that all remaining differences arise in glass.
