import * as THREE from 'three';
import worldURL from './assets/lobby-pixel/world-polished-v2.webp?url';
import portraitURL from './assets/lobby-pixel/world-mobile-polished-v2.webp?url';
import mistURL from './assets/lobby-pixel/mist.webp?url';

const VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.9999,1.);}`;
const FRAGMENT=`
 precision highp float;
 uniform sampler2D uWorld;
 uniform vec2 uCover;
 uniform vec2 uPortalCenter;
 uniform vec2 uPortalRadius;
 uniform float uTime;
 uniform float uEffects;
 uniform float uPortrait;
 varying vec2 vUv;
 vec3 readWorld(vec2 topUV){return texture2D(uWorld,vec2(topUV.x,1.-topUV.y)).rgb;}
 void main(){
  vec2 p=(vec2(vUv.x,1.-vUv.y)-.5)*uCover+.5;
  vec3 original=readWorld(p),color=original;
  if(uEffects>.5){
   // Animate the original portal pixels, never a second superimposed ring.
   vec2 q=(p-uPortalCenter)/uPortalRadius;
   float r=length(q);
   float portal=(1.-smoothstep(.72,1.02,r));
   float a=.045*sin(uTime*.48)+.022*sin(r*12.-uTime*.9);
   mat2 rotation=mat2(cos(a),-sin(a),sin(a),cos(a));
   vec2 warped=uPortalCenter+(rotation*q)*uPortalRadius;
   float groundLimit=mix(.590,.605,uPortrait);
   portal*=1.-smoothstep(groundLimit-.035,groundLimit,p.y);
   portal*=1.-smoothstep(groundLimit-.035,groundLimit,warped.y);
   color=mix(original,readWorld(warped),portal*.85);
   float phase=atan(q.y,q.x)*7.-uTime*2.1+r*17.;
   float bright=smoothstep(.20,.65,max(color.r,max(color.g,color.b)));
   color*=1.+portal*bright*.10*sin(phase);
   // Small advection in the blue / amber cloud pockets. Structures remain still.
   float left=1.-smoothstep(.03,.36,p.x),right=smoothstep(.69,.99,p.x);
   float low=smoothstep(.38,.68,p.y)*(1.-smoothstep(.96,1.,p.y));
   float maximum=max(original.r,max(original.g,original.b)),minimum=min(original.r,min(original.g,original.b));
   float haze=(1.-smoothstep(.15,.40,maximum-minimum))*smoothstep(.035,.12,maximum)*(1.-smoothstep(.46,.78,maximum));
   float edge=length(original-readWorld(p+vec2(.001,0.)))+length(original-readWorld(p+vec2(0.,.0018)));
   haze*=1.-smoothstep(.05,.18,edge);
   float cloud=(left+right)*low*haze;
   vec2 flow=vec2(sin(p.y*24.+uTime*.25)+sin(p.x*17.-uTime*.16),cos(p.x*19.+uTime*.18));
   vec2 cloudUV=p+flow*vec2(.0025,.0018);
   color=mix(color,readWorld(cloudUV),cloud*.70);
   // Water-only motion: scrolling light ripples and a small downward flow warp.
   float riverZone=(1.-smoothstep(.25,.32,p.x))*smoothstep(mix(.55,.49,uPortrait),mix(.59,.53,uPortrait),p.y);
   float waterMask=riverZone*smoothstep(.08,.35,original.b-original.r)*smoothstep(.27,.68,original.g);
   vec2 waterUV=p+vec2(.0009*sin(p.y*92.-uTime*2.6),.0032*sin(p.y*71.-uTime*3.1));
   float stream=sin(p.y*280.-uTime*7.+p.x*61.);
   color=mix(color,readWorld(waterUV)*(1.+.065*stream),waterMask*.88);
  }
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`;

const PRESETS={
 landscape:{url:worldURL,center:[.500,.438],radius:[.147,.224],emitters:[[.301,.345],[.695,.242],[.763,.796]]},
 portrait:{url:portraitURL,center:[.500,.385],radius:[.315,.175],emitters:[[.165,.305],[.772,.240],[.918,.688]]},
};
const wrap=n=>n-Math.floor(n);
export function createLobbyAtmosphere(parent,{mobile=false,reducedMotion=false}={}){
 const root=new THREE.Group();root.name='Single portal, drifting haze and crystal sparks';parent.add(root);
 let width=innerWidth,height=innerHeight,preset,texture,disposed=false,enabled=!reducedMotion,time=0,loadVersion=0;
 const cache=new Map(),loader=new THREE.TextureLoader();
 const uniforms={uWorld:{value:null},uCover:{value:new THREE.Vector2(1,1)},uPortalCenter:{value:new THREE.Vector2()},uPortalRadius:{value:new THREE.Vector2()},uTime:{value:0},uEffects:{value:0},uPortrait:{value:0}};
 const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,depthTest:false,depthWrite:false,toneMapped:false});
 const plane=new THREE.Mesh(geometry,material);plane.name='Animated world plate';plane.frustumCulled=false;plane.renderOrder=-1000;plane.visible=false;root.add(plane);
 const count=mobile?16:36,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));sparkGeometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));sparkGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 for(let i=0;i<count;i++)sizes[i]=(mobile?2.6:3.2)+(i%5)*.37;
 const sparkMaterial=new THREE.ShaderMaterial({uniforms:{uDpr:{value:Math.min(devicePixelRatio,mobile?1.25:1.5)}},vertexShader:'attribute vec3 aColor;attribute float aSize;uniform float uDpr;varying vec3 vColor;void main(){vColor=aColor;gl_Position=vec4(position.xy,.999,1.);gl_PointSize=aSize*uDpr;}',fragmentShader:'varying vec3 vColor;void main(){vec2 q=(gl_PointCoord-.5)*2.;float d=dot(q,q);float a=(1.-smoothstep(.05,1.,d));gl_FragColor=vec4(vColor*(.75+.25*exp(-d*12.)),a);#include <colorspace_fragment>\n}',transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,toneMapped:false});
 // Keep the include on its own preprocessor line.
 sparkMaterial.fragmentShader=sparkMaterial.fragmentShader.replace(';#include',';\n#include');
 const sparks=new THREE.Points(sparkGeometry,sparkMaterial);sparks.name='Live crystal embers';sparks.frustumCulled=false;sparks.renderOrder=-990;root.add(sparks);
 const gold=new THREE.Color('#ffd18b');
 const smokeCount=mobile?2:4,smokeGeometry=new THREE.InstancedBufferGeometry(),smokePlane=new THREE.PlaneGeometry(1,1);smokeGeometry.index=smokePlane.index;smokeGeometry.attributes=smokePlane.attributes;smokeGeometry.instanceCount=smokeCount;
 const smokeAnchors=new Float32Array(smokeCount*4),smokeColors=new Float32Array(smokeCount*3),smokePhases=new Float32Array(smokeCount);smokeGeometry.setAttribute('aAnchor',new THREE.InstancedBufferAttribute(smokeAnchors,4).setUsage(THREE.DynamicDrawUsage));smokeGeometry.setAttribute('aTint',new THREE.InstancedBufferAttribute(smokeColors,3));smokeGeometry.setAttribute('aPhase',new THREE.InstancedBufferAttribute(smokePhases,1));
 for(let i=0;i<smokeCount;i++){const c=new THREE.Color(i%2?'#cbb0a9':'#a5c6e6');smokeColors.set([c.r,c.g,c.b],i*3);smokePhases[i]=i*2.13;}
 const mistTexture=loader.load(mistURL);mistTexture.colorSpace=THREE.SRGBColorSpace;mistTexture.generateMipmaps=false;mistTexture.minFilter=THREE.LinearFilter;
 const smokeMaterial=new THREE.ShaderMaterial({uniforms:{uMist:{value:mistTexture},uTime:uniforms.uTime,uCover:uniforms.uCover,uMobile:{value:Number(mobile)}},vertexShader:`attribute vec4 aAnchor;attribute vec3 aTint;attribute float aPhase;uniform vec2 uCover;uniform float uTime;uniform float uMobile;varying vec2 vUv;varying vec3 vTint;varying float vAlpha;void main(){vUv=uv;vTint=aTint;float t=uTime*.22+aPhase;vec2 shift=vec2(sin(t)*.045,cos(t*.7)*.016);vec2 p=aAnchor.xy+vec2(position.x,-position.y)*aAnchor.zw+shift;vec2 screen=(p-.5)/uCover+.5;gl_Position=vec4(screen.x*2.-1.,1.-screen.y*2.,.9995,1.);vAlpha=(.32+.065*sin(t*.9))*(1.-uMobile*.18);}`,fragmentShader:`uniform sampler2D uMist;varying vec2 vUv;varying vec3 vTint;varying float vAlpha;void main(){vec4 mist=texture2D(uMist,vUv);float feather=smoothstep(0.,.16,vUv.x)*smoothstep(0.,.16,1.-vUv.x)*smoothstep(0.,.14,vUv.y)*smoothstep(0.,.14,1.-vUv.y);gl_FragColor=vec4(mist.rgb*vTint,mist.a*vAlpha*feather);\n#include <colorspace_fragment>\n}`,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
 const smoke=new THREE.Mesh(smokeGeometry,smokeMaterial);smoke.name='Drifting side mist';smoke.frustumCulled=false;smoke.renderOrder=-995;root.add(smoke);
 function placeMist(){const anchors=preset==='portrait'?[[.025,.76,.66,.30],[.98,.77,.60,.30]]:[[.045,.73,.56,.34],[.97,.72,.53,.34],[.015,.43,.37,.23],[.99,.40,.35,.22]];for(let i=0;i<smokeCount;i++)smokeAnchors.set(anchors[i%anchors.length],i*4);smokeGeometry.attributes.aAnchor.needsUpdate=true;}
 function fit(){if(!texture)return;const imageAspect=texture.image.width/texture.image.height,viewAspect=width/height;uniforms.uCover.value.set(Math.min(1,viewAspect/imageAspect),Math.min(1,imageAspect/viewAspect));}
 function resize(w,h){
  width=Math.max(1,w);height=Math.max(1,h);const next=w<=700&&h>540?'portrait':'landscape';
  if(preset===next){fit();return;}preset=next;placeMist();const data=PRESETS[next];uniforms.uPortalCenter.value.set(...data.center);uniforms.uPortalRadius.value.set(...data.radius);uniforms.uPortrait.value=Number(next==='portrait');const version=++loadVersion;
  if(cache.has(next)){texture=cache.get(next);uniforms.uWorld.value=texture;plane.visible=true;document.body.dataset.atmosphereReady='true';fit();return;}
  plane.visible=false;document.body.dataset.atmosphereReady='false';loader.load(data.url,result=>{if(disposed){result.dispose();return;}result.colorSpace=THREE.SRGBColorSpace;result.minFilter=THREE.LinearFilter;result.magFilter=THREE.LinearFilter;result.generateMipmaps=false;cache.set(next,result);if(version!==loadVersion)return;texture=result;uniforms.uWorld.value=result;plane.visible=true;document.body.dataset.atmosphereReady='true';fit();});
 }
 function update(dt,{effects=true}={}){
  enabled=effects&&!reducedMotion;uniforms.uEffects.value=Number(enabled);if(enabled&&Number.isFinite(dt)&&dt>0)time+=Math.min(dt,.12);uniforms.uTime.value=time;sparks.visible=enabled&&plane.visible;smoke.visible=enabled&&plane.visible;
  if(!sparks.visible)return;const sources=PRESETS[preset].emitters,cover=uniforms.uCover.value;
  for(let i=0;i<count;i++){
   const seed=wrap(Math.sin(i*127.1+3.4)*43758.5453),seed2=wrap(Math.sin(i*313.7+9.1)*19487.124),life=.7+seed2*.8,age=wrap(time/life+i*.6180339),t=age*life,source=sources[i%sources.length],vx=(seed-.5)*.072,vy=-.055-seed2*.045;
   const x=source[0]+vx*t,y=source[1]+vy*t+.021*t*t;
   const sx=(x-.5)/cover.x+.5,sy=(y-.5)/cover.y+.5;
   const j=i*3;positions[j]=sx*2-1;positions[j+1]=1-sy*2;positions[j+2]=0;
   const fade=Math.sin(age*Math.PI)*(.55+seed*.45);colors[j]=gold.r*fade;colors[j+1]=gold.g*fade;colors[j+2]=gold.b*fade;
  }
  sparkGeometry.attributes.position.needsUpdate=true;sparkGeometry.attributes.aColor.needsUpdate=true;
 }
 resize(width,height);
 return{root,uniforms,plane,sparks,smoke,resize,update,get time(){return time;},get enabled(){return enabled;},get preset(){return preset;},get particleCount(){return count;},get smokeCount(){return smokeCount;},get ready(){return plane.visible;},dispose(){disposed=true;geometry.dispose();material.dispose();sparkGeometry.dispose();sparkMaterial.dispose();smokeGeometry.dispose();smokeMaterial.dispose();mistTexture.dispose();for(const t of cache.values())t.dispose();root.removeFromParent();}};
}
