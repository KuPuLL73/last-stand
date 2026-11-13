import * as THREE from 'three';
import blockAtlasURL from './assets/cubic/block-atlas.png?url';
import {PixelEffects} from './pixel-effects.js';

const comboRadiusToAtlasSize = 64 / 27;
export class SurvivalEffects{
 constructor(scene,{camera=null,mobile=false}={}){
  this.scene=scene;this.particles=[];this.rings=[];this.blasts=[];this.capacity=320;
  const positions=new Float32Array(this.capacity*3),colours=new Float32Array(this.capacity*3);
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('color',new THREE.BufferAttribute(colours,3).setUsage(THREE.DynamicDrawUsage));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#fff');gradient.addColorStop(.45,'#ffffffe0');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
  this.texture=new THREE.CanvasTexture(canvas);this.material=new THREE.PointsMaterial({size:.19,map:this.texture,vertexColors:true,transparent:true,depthWrite:false,toneMapped:false});this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;scene.add(this.points);this.geometry.setDrawRange(0,0);
  this.ringGeometry=new THREE.RingGeometry(.84,1,64);
  this.pixelEffects=new PixelEffects(scene,{mobile});
  this.camera=camera;this.abilityCapacity=mobile?240:400;this.abilityParticles=[];this.abilityGroup=new THREE.Group();this.abilityGroup.name='Boss and skill effects · seven shared batches';scene.add(this.abilityGroup);this.abilityBatches={};this.abilityGeometries=new Set();this.abilityMaterials=new Set();this.abilityClock=0;this.disposed=false;this._abilityDummy=new THREE.Object3D();this._abilityColor=new THREE.Color();this._followPosition={x:0,z:0};
  this.blockAtlas=new THREE.TextureLoader().load(blockAtlasURL);this.blockAtlas.colorSpace=THREE.SRGBColorSpace;this.blockAtlas.magFilter=this.blockAtlas.minFilter=THREE.NearestFilter;this.blockAtlas.generateMipmaps=false;
  const stone=new THREE.BoxGeometry(1,1,1),uv=stone.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(104+uv.getX(i)*16)/128,1-(40+(1-uv.getY(i))*16)/128);
  this._abilityBatch('stone',stone,new THREE.MeshStandardMaterial({map:this.blockAtlas,roughness:1,transparent:true,depthWrite:true}));
  this._abilityBatch('glow',new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  this._abilityBatch('cloud',new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  this._abilityBatch('sonic',new THREE.RingGeometry(.86,1,40),new THREE.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending}));
  this._abilityBatch('beam',new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({transparent:true,opacity:.3,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  this._abilityBatch('shield',new THREE.CylinderGeometry(1,1,1,8,1,true,-Math.PI*.72,Math.PI*1.44),new THREE.MeshBasicMaterial({transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  const flame=new THREE.SphereGeometry(1,8,7),flamePositions=flame.attributes.position;
  for(let i=0;i<flamePositions.count;i++){const h=(flamePositions.getY(i)+1)*.5,taper=Math.pow(1-h,.65);flamePositions.setXYZ(i,flamePositions.getX(i)*.64*taper+Math.sin(h*2.5)*h*.32,h*2,flamePositions.getZ(i)*.64*taper);}
  flame.computeVertexNormals();
  this._abilityBatch('flame',flame,new THREE.MeshBasicMaterial({transparent:true,opacity:.72,depthWrite:false,toneMapped:false}));
 }
 _abilityBatch(kind,geometry,material){
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(this.abilityCapacity),1);geometry.setAttribute('instanceEffectAlpha',alpha);
  material.onBeforeCompile=shader=>{shader.vertexShader='attribute float instanceEffectAlpha;\nvarying float vEffectAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEffectAlpha = instanceEffectAlpha;');shader.fragmentShader='varying float vEffectAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vEffectAlpha;');};material.customProgramCacheKey=()=> 'survival-ability-alpha-v1';
  const mesh=new THREE.InstancedMesh(geometry,material,this.abilityCapacity);mesh.name='Ability '+kind;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.abilityGroup.add(mesh);this.abilityBatches[kind]={mesh,alpha,count:0};this.abilityGeometries.add(geometry);this.abilityMaterials.add(material);
 }
 _emit(kind,options={}){
  if(this.disposed||this.abilityParticles.length>=this.abilityCapacity)return;
  const duration=Math.max(.05,options.duration||.6),delay=Math.max(0,options.delay||0);
  this.abilityParticles.push({kind,x:0,y:0,z:0,vx:0,vy:0,vz:0,sx:.1,sy:.1,sz:.1,rx:0,ry:0,rz:0,gravity:0,spin:0,age:-delay,duration,opacity:1,grow:0,...options,age:-delay,duration,colour:new THREE.Color(options.colour||'#ffffff')});
 }
 _stoneStrike(event,fire){
  const x=event.x||0,z=event.z||0,r=Math.min(3.2,event.radius||2.2),count=fire?24:10;
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2+.3,rho=fire?Math.sqrt(Math.random())*r*.65:r*.76,s=.15+Math.random()*(fire?.34:.16);this._emit('stone',{x:x+Math.sin(a)*rho,y:fire?.16:-.13,z:z+Math.cos(a)*rho,sx:s,sy:fire?s*.8:s*1.4,sz:s,ry:a,rx:Math.random(),vx:fire?Math.sin(a)*(1+Math.random()*2):0,vy:fire?2+Math.random()*4:.38,vz:fire?Math.cos(a)*(1+Math.random()*2):0,gravity:fire?9:0,spin:fire?3:0,duration:fire?.8:Math.min(1.2,event.duration||1.1),grow:fire?-.35:.5,colour:fire?'#c5b69f':'#9e9585'});}
  if(fire)for(let i=0;i<7;i++){const a=i/7*Math.PI*2;this._emit('cloud',{x:x+Math.sin(a)*r*.45,y:.2,z:z+Math.cos(a)*r*.45,sx:.65,sy:.5,sz:1,vy:.5,vx:Math.sin(a)*.45,vz:Math.cos(a)*.45,grow:1.7,duration:.75,colour:'#b5a38b'});}
 }
 bossAbility(event={}){
  if(this.disposed||event.stage==='track')return;
  const ability=event.ability||event.bossAbility||'',stage=event.stage||'fire',fire=stage==='fire',x=Number.isFinite(event.x)?event.x:0,z=Number.isFinite(event.z)?event.z:0,fromX=Number.isFinite(event.fromX)?event.fromX:x,fromZ=Number.isFinite(event.fromZ)?event.fromZ:z;
  if(stage==='phase'||ability==='phase-change'){
   const colour=event.bossVariant==='wither'?'#91bcd5':event.bossVariant==='ender-dragon'?'#cc8af5':event.bossVariant==='warden'?'#6af7dd':'#ffe19a';
   for(let i=0;i<12;i++){const a=i/12*Math.PI*2;this._emit('glow',{x:x+Math.sin(a)*1.1,y:.25,z:z+Math.cos(a)*1.1,sx:.06,sy:.9+Math.random()*.8,sz:.06,vy:1.2,duration:.6,colour,orbit:.8,centerX:x,centerZ:z,phase:a,orbitRadius:1.1});}return;
  }
  if(['golem-smash','stone-wave','brute-smash','brute-landing'].includes(ability)){if(stage==='windup'||fire)this._stoneStrike({...event,x,z},fire);return;}
  if(ability==='sonic-boom'){
   if(!fire&&stage!=='windup')return;const dx=x-fromX,dz=z-fromZ,length=Math.hypot(dx,dz)||8,angle=Math.atan2(dx,dz),count=fire?8:3;
   for(let i=0;i<count;i++){const f=fire?(i+.4)/count:0;this._emit('sonic',{x:fromX+dx*f,y:event.fromY||1.7,z:fromZ+dz*f,sx:fire?.35:.20,sy:fire?.35:.20,sz:1,ry:angle,duration:fire?.5:Math.min(1.4,event.duration||1.4),delay:fire?i*.035:i*.12,grow:fire?1.5:1.3,colour:'#76ffe2',opacity:fire?.85:.45,vx:fire?dx/length*3:0,vz:fire?dz/length*3:0});}return;
  }
  if(ability==='sonic-ring'||ability==='guardian-pulse'){
   if(!fire)return;const r=event.radius||4,colour=ability==='sonic-ring'?'#6dffe4':'#ffe5a0';for(let i=0;i<3;i++)this._emit('sonic',{x,y:.15+i*.22,z,sx:r,sy:r,sz:1,rx:-Math.PI/2,duration:.55,grow:.08,delay:i*.045,colour,opacity:.55});return;
  }
  if(ability==='guardian-beam'){
   const dx=x-fromX,dz=z-fromZ,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
   if(fire&&length>.01){this._emit('beam',{x:(x+fromX)/2,y:event.fromY||1.6,z:(z+fromZ)/2,sx:.35,sy:.35,sz:length,ry:angle,duration:.55,colour:'#fbc251'});this._emit('glow',{x:(x+fromX)/2,y:event.fromY||1.6,z:(z+fromZ)/2,sx:.055,sy:.055,sz:length,ry:angle,duration:.45,colour:'#fff8d2'});for(let i=0;i<12;i++)this._emit('glow',{x,y:.3+Math.random()*1.5,z,sx:.035,sy:.16,sz:.035,vx:(Math.random()-.5)*3,vy:1+Math.random()*2,vz:(Math.random()-.5)*3,gravity:4,duration:.55,colour:'#ffe39a'});}
   else if(stage==='windup'||stage==='lock'){const count=stage==='lock'?12:18;for(let i=0;i<count;i++){const a=i/count*Math.PI*2;this._emit('glow',{x:fromX,y:event.fromY||1.6,z:fromZ,sx:.045,sy:.13,sz:.045,orbit:2.2,centerX:fromX,centerZ:fromZ,phase:a,orbitRadius:.55,duration:stage==='lock'?.5:Math.min(3,event.duration||1.6),colour:'#ffe4a0',grow:-.5});}}return;
  }
  if(ability==='wither-bombardment'||ability==='skull-volley'){
   if(!fire&&stage!=='windup')return;const centreX=ability==='skull-volley'?fromX:x,centreZ=ability==='skull-volley'?fromZ:z,r=ability==='skull-volley'?.8:Math.min(1.8,event.radius||1.5);
   for(let i=0;i<(fire?14:8);i++){const a=Math.random()*Math.PI*2,rho=Math.sqrt(Math.random())*r*.65;this._emit('cloud',{x:centreX+Math.sin(a)*rho,y:fire?.2:1.1,z:centreZ+Math.cos(a)*rho,sx:fire?.65:.4,sy:fire?.65:.4,sz:1,vy:fire?1.1:.35,duration:fire?1.1:.8,grow:1.4,colour:i%3?'#192632':'#80a7bc',opacity:fire?.9:.5});}
   if(fire)for(let i=0;i<14;i++){const a=i/14*Math.PI*2;this._emit('stone',{x:centreX,y:.2,z:centreZ,sx:.08+Math.random()*.15,sy:.12,sz:.12,vx:Math.sin(a)*(1+Math.random()),vy:2+Math.random()*3,vz:Math.cos(a)*(1+Math.random()),gravity:8,spin:4,duration:.8,colour:i%3?'#25323d':'#a7d7e9'});}return;
  }
  if(ability==='dragon-breath'){
   const r=Math.min(2.2,event.radius||1.55);if(fire){for(let i=0;i<18;i++){const a=i*2.399,rho=Math.sqrt((i+.5)/18)*r*.65;this._emit('flame',{x:x+Math.sin(a)*rho,y:.06,z:z+Math.cos(a)*rho,sx:.20+Math.random()*.15,sy:.25+Math.random()*.4,sz:.20+Math.random()*.15,ry:a,duration:Math.min(3,event.zoneDuration||3),flow:'fire',phase:i,colour:i%3?'#8f42c7':'#c98df1',opacity:.8});}for(let i=0;i<9;i++){const a=i*2.399,rho=r*.45;this._emit('cloud',{x:x+Math.sin(a)*rho,y:.35,z:z+Math.cos(a)*rho,sx:.5,sy:.5,sz:1,vy:.12,duration:3,flow:'breath',phase:i,colour:'#8644b7',opacity:.7});}}
   else if(stage==='windup')for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this._emit('glow',{x:x+Math.sin(a)*r*.65,y:.2,z:z+Math.cos(a)*r*.65,sx:.045,sy:.15,sz:.045,vy:.3,duration:Math.min(1,event.duration||1),colour:'#c18be8'});}return;
  }
  if(ability==='brute-charge'||ability==='dragon-flyby'){
   if(stage==='windup'){const dx=x-fromX,dz=z-fromZ,angle=Math.atan2(dx,dz);for(let i=0;i<5;i++)this._emit('glow',{x:fromX+dx*i/12,y:.3,z:fromZ+dz*i/12,sx:.07,sy:.07,sz:.3,ry:angle,duration:.6,delay:i*.06,colour:ability==='dragon-flyby'?'#bc7fee':'#e8b680'});}else if(stage==='recover')this._stoneStrike({...event,radius:1.5},true);
  }
 }
 skill(event={}){
  const kind=event.ability||event.type,x=event.x||0,z=event.z||0,dx=Number.isFinite(event.dx)?event.dx:0,dz=Number.isFinite(event.dz)?event.dz:1,angle=Math.atan2(dx,dz);
  if(kind==='dash'){this._followPosition={x,z};for(let i=0;i<9;i++){const f=i/8;this._emit('glow',{x:x+dx*5*f,y:.55,z:z+dz*5*f,sx:.055,sy:.65,sz:.8,ry:angle,duration:.25,delay:f*.32,colour:i%2?'#9ef5df':'#f4fff5',grow:-.5});}for(const side of[-1,1])this._emit('glow',{x:x+dz*.45*side,y:.38,z:z-dx*.45*side,sx:.035,sy:.035,sz:1.8,ry:angle,vx:dx*9,vz:dz*9,duration:.35,colour:'#91e9da'});}
  else if(kind==='bulwark'){this._followPosition={x,z};const duration=Math.min(4,event.duration||4);this._emit('shield',{x,y:.85,z,sx:.95,sy:1.45,sz:.95,ry:angle,duration,colour:'#91e9db',follow:true,anchorX:x,anchorZ:z,flow:'shield'});for(let i=0;i<9;i++){const a=angle+(i/8-.5)*Math.PI*1.44;this._emit('glow',{x:x+Math.sin(a)*.96,y:.85,z:z+Math.cos(a)*.96,sx:.035,sy:1.48,sz:.035,ry:a,duration,colour:i%2?'#7dbbae':'#e9f3cd',follow:true,anchorX:x,anchorZ:z,flow:'shield'});}}
  else if(kind==='reflect'){for(let i=0;i<5;i++)this._emit('glow',{x,y:.7+(i-2)*.10,z,sx:.035,sy:.035,sz:.35,ry:angle,vx:dx*(4+i),vz:dz*(4+i),duration:.3,colour:i%2?'#fff6bc':'#94f7e5'});}
  else if(kind==='dashend'){for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this._emit('glow',{x,y:.35,z,sx:.04,sy:.09,sz:.23,ry:a,vx:Math.sin(a)*2,vz:Math.cos(a)*2,duration:.3,colour:'#ccfff0'});}}
 }
 pixel(kind,options){return this.pixelEffects.emit(kind,options);}
 combo(event={}, {reducedMotion=false}={}){
  const {combo,x,z}=event;
  if(this.disposed||!Number.isFinite(x)||!Number.isFinite(z))return;
  if(combo==='shrapnel-line'){
   this._comboShrapnel(event,reducedMotion);
   return;
  }
  if((combo!=='echo-wave'&&combo!=='fire-ricochet')||!Number.isFinite(event.radius)||event.radius<=0)return;

  const radius=Math.min(6,event.radius);
  const echo=combo==='echo-wave';
  const origin={x,z};
  const pixelKind=echo?'combo-echo':'combo-fire';
  if(this.pixel(pixelKind,{...origin,y:.13,ground:true,size:radius*comboRadiusToAtlasSize,
   duration:echo?.46:.43,priority:3,reducedMotion})){
   if(!echo)this.pixel('ricochet',{...origin,y:.69,size:.88,duration:.18,priority:2,reducedMotion});
   return;
  }
  const edge=echo ? '#b8fff1' : '#ffb74b';
  const inner=echo ? '#499aff' : '#ff6c24';
  const start=reducedMotion ? 1 : echo ? .38 : .32;
  const pulseTime=reducedMotion ? .24 : echo ? .46 : .4;
  this._emit('sonic',{
   ...origin,y:.13,rx:-Math.PI/2,sx:radius*start,sy:radius*start,sz:1,
   colour:edge,duration:pulseTime,grow:1/start-1,opacity:echo ? .95 : .86,
  });
  const inset=radius*(echo ? .81 : .72)*start;
  this._emit('sonic',{
   ...origin,y:.18,rx:-Math.PI/2,sx:inset,sy:inset,sz:1,
   colour:inner,duration:pulseTime,delay:reducedMotion ? 0 : .05,grow:1/start-1,opacity:.66,
  });

  if(!echo){
   // The small violet impact is followed by amber sparks, then clears.
   // Enemy burn lives on the enemy render, never on the arena floor.
   this._emit('glow',{
    ...origin,y:.58,sx:.24,sy:.52,sz:.24,rx:.45,rz:.55,
    colour:'#c578ff',duration:.16,grow:-.65,opacity:.75,
   });
   for(let i=0;i<(reducedMotion ? 2 : 5);i++){
    const angle=i*2.399;
    const offset=radius*(.35+.1*(i%3));
    this._emit('flame',{
     x:x+Math.sin(angle)*offset,y:.1,z:z+Math.cos(angle)*offset,
     sx:.12,sy:.23,sz:.12,ry:angle,vy:reducedMotion ? 0 : .8,
     colour:i%2 ? '#ff7e28' : '#ffcb67',duration:.31,grow:-.44,opacity:.72,
    });
   }
  }

  const count=reducedMotion ? 4 : echo ? 12 : 9;
  const life=echo ? .42 : .36;
  const speed=reducedMotion ? 0 : radius*.41/life;
  for(let i=0;i<count;i++){
   const angle=i/count*Math.PI*2;
   const dx=Math.sin(angle),dz=Math.cos(angle);
   const offset=radius*(reducedMotion ? .73 : .48);
   this._emit('glow',{
    x:x+dx*offset,y:.22,z:z+dz*offset,
    vx:dx*speed,vy:reducedMotion ? 0 : .65+(i%3)*.28,vz:dz*speed,
    sx:.045,sy:echo ? .15 : .085,sz:echo ? .11 : .16,ry:angle,rz:i%2 ? .6 : -.6,
    gravity:reducedMotion ? 0 : 3.5,spin:reducedMotion ? 0 : 2.1,
    colour:i%3 ? edge : inner,duration:life,opacity:.9,grow:-.5,
   });
  }
 }
 _comboShrapnel({x,z,dx,dz,range,spread},reducedMotion){
  if(![dx,dz,range].every(Number.isFinite)||Math.hypot(dx,dz)<.001||range<=0)return;
  const bearing=Math.atan2(dx,dz);
  const halfAngle=Number.isFinite(spread) ? THREE.MathUtils.clamp(spread,0,.4) : .12;
  const reach=Math.min(8,range);
  // The fan occupies x=13…55 within its 64 px tile. Anchor its painted tail at the launch point.
  const fanWidth=reach*64/42;
  const fanOffset=fanWidth*19/64;
  if(this.pixel('combo-shrapnel',{
   x:x+Math.sin(bearing)*fanOffset,y:.69,z:z+Math.cos(bearing)*fanOffset,
   width:fanWidth,height:Math.max(.66,reach*Math.sin(halfAngle)*3.7),rotation:bearing,ground:true,
   duration:.23,priority:3,reducedMotion,
  })){
   this.pixel('impact',{x,z,y:.86,size:.9,duration:.14,priority:2,reducedMotion});
   return;
  }
  const duration=reducedMotion ? .23 : .2;
  const length=reach*(reducedMotion ? .53 : .23);
  const speed=reducedMotion ? 0 : (reach-length)/duration;
  for(const side of [-1,0,1]){
   const angle=bearing+side*halfAngle;
   const tx=Math.sin(angle),tz=Math.cos(angle);
   const streak={
    x:x+tx*length/2,y:.69,z:z+tz*length/2,ry:angle,
    vx:tx*speed,vz:tz*speed,duration,grow:-.26,
   };
   this._emit('glow',{
    ...streak,sx:.1,sy:.09,sz:length,colour:'#ff6025',opacity:.64,
   });
   this._emit('glow',{
    ...streak,sx:.04,sy:.045,sz:length*.8,colour:'#ffe1a0',opacity:.96,
   });
  }
  this._emit('glow',{
   x,y:.69,z,sx:.15,sy:.19,sz:.15,ry:bearing,
   colour:'#ffbd54',duration:.14,opacity:.75,grow:-.45,
  });
 }
 emberImpact(x,z,radius=.55){const r=Math.min(1.5,Math.max(.2,radius));for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this._emit('flame',{x:x+Math.sin(a)*r*.55,y:.05,z:z+Math.cos(a)*r*.55,sx:.10,sy:.23,sz:.10,vy:.25,duration:.38,flow:'fire',phase:i,colour:i%2?'#ff6f18':'#ffe0a0'});}for(let i=0;i<4;i++)this._emit('glow',{x,y:.3,z,sx:.04,sy:.04,sz:.04,vx:(Math.random()-.5)*3,vy:1+Math.random(),vz:(Math.random()-.5)*3,gravity:4,duration:.4,colour:'#ffb94a'});}
 _updateAbilities(dt,{player=null,camera=this.camera}={}){
  this.abilityClock+=dt;if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z)){this._followPosition.x=player.x;this._followPosition.z=player.z;}
  for(const batch of Object.values(this.abilityBatches))batch.count=0;
  for(let i=this.abilityParticles.length-1;i>=0;i--){const p=this.abilityParticles[i];p.age+=dt;if(p.age>=p.duration){this.abilityParticles.splice(i,1);continue;}if(p.age<0)continue;
   p.vy-=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rx+=p.spin*dt;p.rz+=p.spin*.7*dt;
   const batch=this.abilityBatches[p.kind],n=batch.count++,f=p.age/p.duration,fade=Math.min(1,p.age/.08)*(1-Math.max(0,(f-.55)/.45)),growth=Math.max(.05,1+p.grow*f),dummy=this._abilityDummy;
   let x=p.x,z=p.z,y=Math.max(p.kind==='stone'?-.2:.03,p.y);
   if(p.follow){x+=this._followPosition.x-p.anchorX;z+=this._followPosition.z-p.anchorZ;}
   if(p.orbit){const a=p.phase+p.age*p.orbit;x=p.centerX+Math.sin(a)*p.orbitRadius*(1-f*.5);z=p.centerZ+Math.cos(a)*p.orbitRadius*(1-f*.5);}
   dummy.position.set(x,y,z);dummy.rotation.set(p.rx,p.ry,p.rz);if(p.kind==='cloud'&&camera)dummy.quaternion.copy(camera.quaternion);
   let sy=p.sy*growth;if(p.flow==='fire'){sy*=.75+Math.sin(p.age*10+p.phase)*.18;dummy.position.y+=Math.sin(p.age*3+p.phase)*.035;}else if(p.flow==='breath'){dummy.position.y+=Math.sin(p.age*2+p.phase)*.09;}else if(p.flow==='shield')sy*=1+Math.sin(p.age*4)*.012;
   dummy.scale.set(p.sx*growth,sy,p.sz*growth);dummy.updateMatrix();batch.mesh.setMatrixAt(n,dummy.matrix);batch.mesh.setColorAt(n,p.colour);batch.alpha.setX(n,fade*p.opacity);
  }
  for(const batch of Object.values(this.abilityBatches)){batch.mesh.count=batch.count;batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;batch.alpha.needsUpdate=true;}
 }
 burst(x,z,count=8,hex='#ffdf86',y=.8){
  for(let i=0;i<count&&this.particles.length<this.capacity;i++)this.particles.push({x,y,z,vx:(Math.random()-.5)*4,vy:1+Math.random()*3,vz:(Math.random()-.5)*4,life:.3+Math.random()*.3,colour:new THREE.Color(hex)});
 }
 ring(x,z,hex='#ffe59a',radius=3){const material=new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});const mesh=new THREE.Mesh(this.ringGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.06,z);mesh.scale.setScalar(.1);this.scene.add(mesh);this.rings.push({mesh,life:.42,max:.42,radius});}
 beam(fromX,fromZ,x,z,colour='#9aeaff'){
  if(![fromX,fromZ,x,z].every(Number.isFinite))return;
  const length=Math.hypot(x-fromX,z-fromZ);if(length<.01)return;
  const mesh=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1);
  mesh.position.set((x+fromX)/2,.95,(z+fromZ)/2);mesh.rotation.y=Math.atan2(x-fromX,z-fromZ);
  for(const[width,hex,opacity]of[[.17,colour,.55],[.05,'#efffff',.95]]){const ray=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity,depthWrite:false,toneMapped:false}));ray.scale.set(width,width,length);mesh.add(ray);}
  this.scene.add(mesh);this.blasts.push({mesh,kind:'beam',life:.24,max:.24});
 }
 shotgun(x,z,dx,dz,superShot=false){
  if(!superShot)return;
  const mesh=new THREE.Group();mesh.position.set(x,.70,z);const geometry=new THREE.SphereGeometry(1,8,6),gold=new THREE.MeshBasicMaterial({color:'#ffd457',transparent:true,opacity:.95,toneMapped:false}),white=new THREE.MeshBasicMaterial({color:'#fffbd8',transparent:true,opacity:1,toneMapped:false});
  for(let i=0;i<9;i++){const a=Math.atan2(dx,dz)+(i/8-.5)*1.16,beam=new THREE.Group(),outer=new THREE.Mesh(geometry,gold),core=new THREE.Mesh(geometry,white);outer.scale.set(.12,.12,.43);core.scale.set(.057,.057,.36);core.position.y=.09;beam.add(outer,core);beam.rotation.y=a;beam.userData.direction=new THREE.Vector3(Math.sin(a),0,Math.cos(a));mesh.add(beam);}
  this.scene.add(mesh);this.blasts.push({mesh,kind:'shotgun',life:.28,max:.28});
 }
 swordSweep(x,z,angle,range=2.7,arc=Math.PI*2/3,color='#a3fff1'){const mesh=new THREE.Group();mesh.position.set(x,.65,z);mesh.rotation.y=angle-Math.PI/2;const g=new THREE.RingGeometry(range*.78,range,32,1,-arc/2,arc);g.rotateX(-Math.PI/2);const crescent=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.62,depthWrite:false,toneMapped:false}));mesh.add(crescent);this.scene.add(mesh);this.blasts.push({mesh,kind:'sweep',life:.17,max:.17});}
 removeBlast(b){this.scene.remove(b.mesh);const geometries=new Set(),materials=new Set();b.mesh.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 update(dt,options={}){
  if(this.disposed||!Number.isFinite(dt)||dt<=0)return;
  this.pixelEffects.update(dt,options.camera||this.camera);
  this._updateAbilities(dt,options);
  const positions=this.geometry.attributes.position,colours=this.geometry.attributes.color;
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.vy-=8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}
  this.particles.forEach((p,i)=>{positions.setXYZ(i,p.x,Math.max(.04,p.y),p.z);colours.setXYZ(i,p.colour.r,p.colour.g,p.colour.b);});positions.needsUpdate=colours.needsUpdate=true;this.geometry.setDrawRange(0,this.particles.length);
  for(let i=this.rings.length-1;i>=0;i--){const r=this.rings[i];r.life-=dt;if(r.life<=0){this.scene.remove(r.mesh);r.mesh.material.dispose();this.rings.splice(i,1);continue;}const progress=1-r.life/r.max;r.mesh.scale.setScalar(.2+progress*r.radius);r.mesh.material.opacity=(1-progress)*.8;}
  for(let i=this.blasts.length-1;i>=0;i--){const b=this.blasts[i];b.life-=dt;if(b.life<=0){this.removeBlast(b);this.blasts.splice(i,1);continue;}const f=1-b.life/b.max;if(b.kind==='shotgun'){for(const beam of b.mesh.children){beam.position.copy(beam.userData.direction).multiplyScalar(f*7.1);for(const child of beam.children)child.material.opacity=Math.min(1,(1-f)*3);}}else if(b.kind==='beam'){for(const child of b.mesh.children)child.material.opacity=(1-f)*.8;}else{b.mesh.scale.setScalar(.75+f*.25);for(const child of b.mesh.children)child.material.opacity=(1-f)*.62;}}
 }
 clear(){this.pixelEffects.clear();this.particles.length=0;this.geometry.setDrawRange(0,0);for(const r of this.rings){this.scene.remove(r.mesh);r.mesh.material.dispose();}this.rings.length=0;for(const b of this.blasts)this.removeBlast(b);this.blasts.length=0;this.abilityParticles.length=0;for(const batch of Object.values(this.abilityBatches))batch.mesh.count=0;this.abilityClock=0;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.pixelEffects.dispose();this.scene.remove(this.points);this.abilityGroup.removeFromParent();this.geometry.dispose();this.ringGeometry.dispose();this.material.dispose();this.texture.dispose();this.blockAtlas.dispose();for(const g of this.abilityGeometries)g.dispose();for(const m of this.abilityMaterials)m.dispose();this.abilityGroup.clear();}
}
