import * as THREE from 'three';

// Small scene-material effects retain the original nearest-filtered block art.
// There is no composer, full-screen blur, refraction buffer or extra shadow pass.
export function createCubicShaders(scene,{mobile=false,reducedMotion=false}={}){
 const uniforms={uCubicTime:{value:0},uCubicEffects:{value:reducedMotion?0:1}};
 const decorated=new Set();let time=0,enabled=!reducedMotion,animating=false;
 const budget=mobile?10:26;
 const points=new Float32Array(budget*3),seeds=new Float32Array(budget);
 for(let i=0;i<budget;i++){
  const seed=((i*1664525+1013904223)>>>0)/4294967296;
  const side=i%2?1:-1;points.set([side*(7.8+(i%5)*1.1),.65+(i%4)*.45,-9+(i*2.73)%21],i*3);seeds[i]=seed*7+i*.79;
 }
 const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));dustGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 const dustMaterial=new THREE.ShaderMaterial({uniforms:{uTime:uniforms.uCubicTime,uMobile:{value:Number(mobile)}},vertexShader:`
  uniform float uTime;uniform float uMobile;attribute float aSeed;varying float vAlpha;
  void main(){vec3 p=position;p.x+=sin(uTime*.19+aSeed)*.3;p.y+=sin(uTime*.26+aSeed*1.7)*.16;p.z+=cos(uTime*.15+aSeed)*.25;vec4 eye=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*eye;gl_PointSize=clamp((42.-uMobile*9.)/max(1.,-eye.z),1.,2.7-uMobile*.5);vAlpha=(.18+.12*sin(uTime*.43+aSeed))*(1.-uMobile*.18);}`,
  fragmentShader:`varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float alpha=(1.-smoothstep(.05,.25,dot(p,p)))*vAlpha;gl_FragColor=vec4(.98,.88,.61,alpha);\n#include <colorspace_fragment>\n}`,
  transparent:true,depthWrite:false,depthTest:true,toneMapped:false,blending:THREE.AdditiveBlending});
 const dust=new THREE.Points(dustGeometry,dustMaterial);dust.name='Subtle sunlit forest dust';dust.frustumCulled=false;dust.visible=enabled;scene.add(dust);

 function decorate(material,{kind='solid',wind=null}={}){
  if(decorated.has(material))return material;
  decorated.add(material);material.userData.cubicEffect={kind,wind};
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
   previous?.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nuniform float uCubicTime;uniform float uCubicEffects;varying vec3 vCubicWorld;`);
   const amplitude=wind==='plant'?(mobile?.035:.065):wind==='leaves'?(mobile?.016:.032):0;
   const anchor=wind==='plant'?'clamp(transformed.y/.6,0.,1.)':'1.';
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 cubicLocal=vec4(transformed,1.);
    #ifdef USE_INSTANCING
     cubicLocal=instanceMatrix*cubicLocal;
    #endif
    vCubicWorld=(modelMatrix*cubicLocal).xyz;
    float cubicAnchor=${anchor};
    float cubicWind=(sin(uCubicTime*.72+vCubicWorld.z*.43)+.35*sin(uCubicTime*1.21+vCubicWorld.x*.77))*${amplitude.toFixed(4)}*cubicAnchor*uCubicEffects;
    vec3 cubicOffset=vec3(cubicWind,0.,cubicWind*.38);
    vCubicWorld+=cubicOffset;mvPosition.xyz+=mat3(viewMatrix)*cubicOffset;
    gl_Position=projectionMatrix*mvPosition;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uCubicTime;uniform float uCubicEffects;varying vec3 vCubicWorld;`);
   if(kind==='water'){
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float cubicWaterLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     vec3 cubicWaterTint=vec3(cubicWaterLuma*.38,cubicWaterLuma*1.30,cubicWaterLuma*1.7)+vec3(.008,.025,.026);
     diffuseColor.rgb=mix(diffuseColor.rgb,cubicWaterTint,.48*uCubicEffects);`);
    // Analytic ripple normals cost two sines and do not move pond geometry.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     float cubicWaveX=sin(vCubicWorld.x*1.55+vCubicWorld.z*.5-uCubicTime*.82);
     float cubicWaveZ=sin(vCubicWorld.z*2.2-vCubicWorld.x*.37+uCubicTime*.63);
     vec3 cubicWaterNormal=normalize(vec3(cubicWaveX*.075,1.,cubicWaveZ*.055));
     normal=normalize(mix(normal,(viewMatrix*vec4(cubicWaterNormal,0.)).xyz,uCubicEffects));
     roughnessFactor=mix(roughnessFactor,.25,uCubicEffects);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     float cubicFresnel=1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.);cubicFresnel=cubicFresnel*cubicFresnel*cubicFresnel;
     outgoingLight=mix(outgoingLight,vec3(.31,.51,.58),(.055+cubicFresnel*.32)*uCubicEffects);
     float cubicRibbon=sin(vCubicWorld.x*3.4+vCubicWorld.z*4.1-uCubicTime*1.15);
     outgoingLight*=1.+cubicRibbon*.035*uCubicEffects;
     float cubicGlint=max(0.,sin(vCubicWorld.x*2.3+vCubicWorld.z*3.2-uCubicTime*.8+.45*sin(vCubicWorld.z*1.7+uCubicTime*.4)));
     cubicGlint*=cubicGlint;cubicGlint*=cubicGlint;cubicGlint*=cubicGlint;
     cubicGlint*=cubicGlint;
     outgoingLight+=vec3(.035,.065,.075)*cubicGlint*uCubicEffects;
     #include <opaque_fragment>`);
   }else{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     vec3 cubicNormalWorld=inverseTransformDirection(normal,viewMatrix);
     float cubicTop=smoothstep(-.15,.85,cubicNormalWorld.y);
     vec3 cubicTint=mix(vec3(.88,.97,1.05),vec3(1.05,1.015,.94),cubicTop);
     outgoingLight=mix(outgoingLight,outgoingLight*cubicTint,uCubicEffects*.55);
     #include <opaque_fragment>`);
   }
   material.userData.cubicCompiled=true;
  };
  material.customProgramCacheKey=()=>`cubic-scene-v1:${kind}:${wind||'none'}:${mobile?'mobile':'desktop'}`;
  return material;
 }
 return{
  decorate,uniforms,dust,
  update({dt=0,effects=true,paused=false}={}){
   enabled=effects!==false&&!reducedMotion;animating=enabled&&!paused&&Number.isFinite(dt)&&dt>0;
   if(animating)time+=Math.min(dt,.12);
   uniforms.uCubicTime.value=time;uniforms.uCubicEffects.value=Number(enabled);dust.visible=enabled;
  },
  get state(){return{enabled,animating,time,mobile,reducedMotion,shaderMaterials:decorated.size,motes:budget,addedDrawCalls:enabled?1:0,compiled:[...decorated].filter(m=>m.userData.cubicCompiled).length};},
  dispose(){dustGeometry.dispose();dustMaterial.dispose();dust.removeFromParent();},
 };
}
