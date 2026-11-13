import './arena.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import modelURL from '../shelly/game/shelly-game.glb?url';
import {createPlatform} from './platform.js';
import {ArenaSound} from './sound.js';
import {MAP,normalize2,movePlayer,segmentCircle,segmentBox,pelletDirections} from './logic.js';

async function boot(){
const $=s=>document.querySelector(s),world=$('#world'),hud=$('#hud');
const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
document.body.classList.toggle('touch-mode',touch);
const platform=await createPlatform(),sound=new ArenaSound();
const english=new URLSearchParams(location.search).get('lang')==='en'||(!platform.standalone&&platform.language!=='ru');
const words=english?{start:'ENTER THE RANGE',resume:'BACK TO TRAINING',loading:'LOADING SHELLY…',pause:'TAKE A BREATH.',pauseDesc:'The range will wait. Come back when you are ready.',ready:'Walk, aim and shoot',reload:'Reloading',ammo:'SHOTGUN',reset:'Targets restored',kill:'TARGET DOWN!',blocked:'Three shells. Let them reload.',range:'DUSTY FRONTIER',shoot:'FIRE',move:'MOVE'}:{start:'НА ПОЛИГОН',resume:'ПРОДОЛЖИТЬ',loading:'ЗАГРУЖАЕМ ШЕЛЛИ…',pause:'ПЕРЕДЫШКА.',pauseDesc:'Полигон подождёт. Возвращайся, когда будешь готов.',ready:'Ходи, прицеливайся и стреляй',reload:'Перезарядка',ammo:'ДРОБОВИК',reset:'Мишени восстановлены',kill:'МИШЕНЬ ПОРАЖЕНА!',blocked:'Три заряда. Дай им восстановиться.',range:'ПЕСЧАНЫЙ РУБЕЖ',shoot:'ПРИЦЕЛ И ОГОНЬ',move:'ДВИЖЕНИЕ'};
if(english){document.documentElement.lang='en';document.title='Shelly — practice range';$('#arena-label').textContent='PRACTICE RANGE';$('.pilot strong').textContent='SHELLY';$('#status-label').textContent='Warm up before the big battle';$('#hit-label').textContent='HITS';$('#target-label').textContent='TARGETS';$('#card-kicker').textContent='FIRST TRAINING';$('#card-title').innerHTML='TIME TO<br><em>WARM UP.</em>';$('#card-description').innerHTML='Explore the range, find a good position<br>and try your shotgun on the targets.';$('#card-controls').innerHTML='<b>WASD / arrows</b><span>move</span><b>Mouse + LMB</b><span>aim and fire</span><b>Space</b><span>shoot at the nearest target</span>';$('#build-label').textContent='Mechanics prototype · no ads or purchases';$('#reset span').textContent='Reset';$('#control-guide').innerHTML='<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span>Mouse — aim · LMB / <kbd>Space</kbd> — fire</span>';$('#pause').setAttribute('aria-label','Pause');$('#sound').setAttribute('aria-label','Sound');}
$('#ammo-label').textContent=words.ammo;$('#range-label').textContent=words.range;$('#move-label').textContent=words.move;$('#fire-label').textContent=words.shoot;$('#start-text').textContent=words.loading;
if(touch)$('#card-controls').innerHTML=english?'<b>Left stick</b><span>move around</span><b>Right stick</b><span>aim and hold to fire</span><b>Tap the fire stick</b><span>aim at the nearest target</span>':'<b>Левый джойстик</b><span>движение</span><b>Правый джойстик</b><span>прицел и огонь при удержании</span><b>Касание правого</b><span>выстрел в ближайшую мишень</span>';

let started=false,userPaused=false,externalPaused=platform.paused,loaded=false,elapsed=0;
const input={keys:new Set(),move:{x:0,z:0},aim:{x:0,z:-1},fire:false,pointerAim:false,stickAim:false};
const player={x:0,z:7.5,radius:.43,speed:4.6,yaw:Math.PI,aim:new THREE.Vector3(0,0,-1),ammo:3,reload:0,cooldown:0,shots:0,hits:0,kills:0};
const obstacles=[{x:-4.0,z:2.8,w:2.1,d:1.25},{x:4.0,z:2,w:2.1,d:1.25},{x:0,z:-2,w:2.4,d:1.1},{x:-6.5,z:-5,w:1.4,d:2.0},{x:6.6,z:-5.1,w:1.45,d:2.0}];
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});}catch(error){$('#start-text').textContent=english?'TRY RELOADING':'ПЕРЕЗАГРУЗИТЬ';$('#card-description').textContent=english?'The range could not start. Reload and try again.':'Не удалось запустить полигон. Перезагрузи страницу и попробуй ещё раз.';$('#start').disabled=false;$('#start').onclick=()=>location.reload();throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.5:2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;world.append(renderer.domElement);renderer.domElement.setAttribute('aria-label',english?'3D practice range':'Трёхмерный полигон');
const scene=new THREE.Scene();scene.background=new THREE.Color('#93b9aa');scene.fog=new THREE.Fog('#93b9aa',36,65);
const camera=new THREE.PerspectiveCamera(40,1,.1,100),cameraTarget=new THREE.Vector3(0,0,3);
scene.add(new THREE.HemisphereLight(0xe5f2d2,0x815535,2.1));
const sun=new THREE.DirectionalLight(0xffe6b7,3.0);sun.position.set(-9,18,10);sun.castShadow=true;sun.shadow.mapSize.set(touch?1024:2048,touch?1024:2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:55});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9eb6ea,.75);fill.position.set(9,8,-9);scene.add(fill);
const mats={};function material(name,color,roughness=1){return mats[name]??=new THREE.MeshStandardMaterial({color,roughness});}
const sand=material('sand','#d5a86a'),sandLight=material('sand-light','#e7bd7c'),wood=material('wood','#956144'),woodLight=material('wood-light','#c49460'),woodDark=material('wood-dark','#644a3c'),metal=material('metal','#365761'),leaf=material('leaf','#377875'),leafLight=material('leaf-light','#4f9981'),rock=material('rock','#9b806d'),yellow=material('yellow','#ffd454'),red=material('red','#dc654c'),cream=material('cream','#fff0c5');
function mesh(geometry,mat,x=0,y=0,z=0,parent=scene,shadows=true){const o=new THREE.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=shadows;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,mat,x,y,z,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
function cylinder(rt,rb,h,mat,x,y,z,parent=scene,segments=12){return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat,x,y,z,parent);}
function ball(r,mat,x,y,z,parent=scene,detail=1){return mesh(new THREE.IcosahedronGeometry(r,detail),mat,x,y,z,parent);}
function ring(radius,color,y=.03){const o=new THREE.Mesh(new THREE.RingGeometry(radius-.035,radius,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));o.rotation.x=-Math.PI/2;o.position.y=y;return o;}
const ground=mesh(new THREE.PlaneGeometry(150,150),sand,0,-.06,0,scene,false);ground.rotation.x=-Math.PI/2;
const arenaFloor=box(23.9,.12,25.9,sandLight,0,-.10,0);arenaFloor.castShadow=false;
// Fine sand marks, sparse tufts and scattered stones give the arena scale.
let seed=781;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<95;i++){const o=mesh(new THREE.CircleGeometry(.12+random()*.7,5),i%2?sand:sandLight,(random()-.5)*23,.001,(random()-.5)*25,scene,false);o.rotation.x=-Math.PI/2;o.scale.y=.2+random()*.5;}
const centerMark=ring(2.1,'#b27a4c',.007);centerMark.material.opacity=.27;centerMark.position.z=5.5;scene.add(centerMark);
function crate(spec){const g=new THREE.Group();g.position.set(spec.x,0,spec.z);scene.add(g);const h=1.18;box(spec.w,h,spec.d,woodLight,0,h/2,0,g);for(const z of [-spec.d/2-.012,spec.d/2+.012]){box(spec.w+.06,.14,.07,woodDark,0,.15,z,g);box(spec.w+.06,.14,.07,woodDark,0,h-.15,z,g);for(const x of [-spec.w/2+.15,spec.w/2-.15])box(.12,h,.08,wood,x,h/2,z,g);const diagonal=box(Math.hypot(spec.w-.35,h-.35),.13,.08,wood,0,h/2,z,g);diagonal.rotation.z=Math.atan2(h-.35,spec.w-.35);}box(spec.w+.08,.10,spec.d+.05,wood,.0,h+.04,.0,g);return g;}
obstacles.forEach(crate);
for(const z of [-13.15,13.15])for(let x=-12;x<=12;x+=2){box(.16,1.1,.17,woodDark,x,.5,z);if(x<12){box(2.1,.16,.12,woodLight,x+1,.45,z);box(2.1,.16,.12,woodLight,x+1,.9,z);}}
for(const x of [-12.1,12.1])for(let z=-12;z<=12;z+=2){box(.16,1.1,.16,woodDark,x,.5,z);if(z<12){box(.12,.16,2.1,woodLight,x,.45,z+1);box(.12,.16,2.1,woodLight,x,.9,z+1);}}
function cactus(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cylinder(.2,.25,1.6,leaf,0,.8,0,g);ball(.21,leaf,0,1.6,0,g);for(const side of [-1,1]){const arm=cylinder(.14,.14,.45,leaf,side*.32,.95+side*.2,0,g);arm.rotation.z=Math.PI/2;cylinder(.14,.14,.5,leaf,side*.53,1.15+side*.2,0,g);ball(.14,leaf,side*.53,1.42+side*.2,0,g);}return g;}
for(const [x,z,s] of [[-13,-9,1.5],[13,8,1.7],[-14,6,1.1],[12.9,-10,1],[-9,-14,1.3],[6,15,1.2]])cactus(x,z,s);
for(let i=0;i<24;i++){const edge=i%2?-1:1,x=edge*(12.8+random()*5),z=(random()-.5)*35;const r=ball(.35+random()*.65,rock,x,.25,z,scene,0);r.scale.set(1.5,.7,1);r.rotation.y=random()*6;}
function bush(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);for(let i=0;i<5;i++){const p=ball((.48+random()*.25)*s,i%2?leaf:leafLight,(random()-.5)*s*1.3,.4*s,(random()-.5)*s*1.3,g,0);p.scale.y=.85;}}
for(const p of [[-9,9],[9,9],[-9,-9],[9,-9],[-2,-11],[2,-11]])bush(...p,1.4);
// Small range buildings outside the walkable boundary.
const shed=box(5,2.8,3.5,material('shed','#768f87'),-7,1.3,-17);const roof=box(5.5,.27,4.0,metal,-7,2.8,-17);roof.rotation.z=-.06;box(1.1,1.9,.10,woodDark,-7,.9,-15.2);box(1.1,.8,.12,cream,-5.5,1.9,-15.18);cylinder(1.15,1.15,3.5,metal,8,1.65,-17,scene,16);cylinder(1.3,1.3,.18,woodDark,8,3.45,-17,scene,16);

const targetSpecs=[[0,1.8],[-3,-6],[3,-6],[0,-9],[7,-1.2],[-7,-1],[4.8,-9.8],[-4.8,-9.8]];
const targets=[];const targetById=new Map();
function createTarget(x,z,index){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);cylinder(.25,.39,.18,metal,0,.09,0,g);cylinder(.065,.085,.75,woodDark,0,.50,0,g);const torso=cylinder(.40,.37,.58,index%2?leaf:woodLight,0,.92,0,g);box(.95,.13,.15,woodDark,0,1,0,g);const head=cylinder(.43,.43,.15,woodLight,0,1.47,.04,g,24);head.rotation.x=Math.PI/2;const diskMat=[red,cream,red];[.34,.23,.11].forEach((r,i)=>{const disk=cylinder(r,r,.016,diskMat[i],0,1.47,.125+i*.015,g,32);disk.rotation.x=Math.PI/2;});const hpGroup=new THREE.Group();hpGroup.position.set(0,2.12,0);g.add(hpGroup);const bg=box(.95,.08,.035,woodDark,0,0,0,hpGroup),hp=box(.89,.045,.045,material('hp','#a8df87'),0,0,.03,hpGroup);hpGroup.visible=false;const t={id:index,x,z,group:g,hpGroup,hpMesh:hp,health:100,alive:true,respawn:0,flash:0,wobble:0,torso};targets.push(t);targetById.set(index,t);}
targetSpecs.forEach(([x,z],i)=>createTarget(x,z,i));
const actor=new THREE.Group();actor.position.set(player.x,0,player.z);scene.add(actor);
const playerRing=ring(.60,'#b6f1cb',.018);actor.add(playerRing);
const arrow=new THREE.Mesh(new THREE.ConeGeometry(.12,.26,3),new THREE.MeshBasicMaterial({color:'#fff0ad'}));arrow.rotation.x=Math.PI/2;arrow.position.set(0,.035,.78);actor.add(arrow);
const aimGuide=new THREE.Group();scene.add(aimGuide);const guideMat=new THREE.LineBasicMaterial({color:'#ffe4a0',transparent:true,opacity:.28,depthWrite:false});
const guideLines=pelletDirections(0,1,3,.36).map(d=>{const o=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(d.x*.75,.028,d.z*.75),new THREE.Vector3(d.x*8.4,.028,d.z*8.4)]),guideMat);aimGuide.add(o);return o;});
const crosshair=ring(.26,'#fff1be',.02);scene.add(crosshair);
let model,mixer,actions={},baseAction=null,attackLeft=0;
const pellets=[],particles=[],numbers=[];const pelletGeo=new THREE.SphereGeometry(.055,6,4),pelletMat=new THREE.MeshBasicMaterial({color:'#fff1b1'}),particleGeo=new THREE.BoxGeometry(.07,.07,.07);
const flash=new THREE.Group();const flashMat=new THREE.MeshBasicMaterial({color:'#fff3b0',transparent:true,depthWrite:false});for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.ConeGeometry(.12,.5,5),flashMat);p.rotation.x=Math.PI/2;p.rotation.z=i*Math.PI/3;flash.add(p);}flash.visible=false;scene.add(flash);let flashTime=0,shake=0;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),1800);}
function clearInput(){input.keys.clear();input.move.x=input.move.z=0;input.fire=false;input.stickAim=false;document.querySelectorAll('.stick i').forEach(o=>o.style.transform='');}
function active(){return loaded&&started&&!userPaused&&!externalPaused;}
function setPaused(v){if(!started)return;userPaused=v;clearInput();platform.setGameplay(!v);$('#shade').hidden=!v;if(v){$('#card-kicker').textContent=english?'TRAINING PAUSED':'ТРЕНИРОВКА НА ПАУЗЕ';$('#card-title').textContent=words.pause;$('#card-description').textContent=words.pauseDesc;$('#start-text').textContent=words.resume;sound.pause();}else sound.unlock();updateHud();}
platform.onPauseChange(paused=>{externalPaused=paused;if(paused){clearInput();sound.pause();}else if(started&&!userPaused)sound.unlock();updateHud();});
$('#start').addEventListener('click',()=>{if(!loaded)return;sound.unlock();if(started)setPaused(false);else{started=true;$('#shade').hidden=true;platform.setGameplay(true);$('#status-label').textContent=words.ready;}});
$('#pause').addEventListener('click',()=>setPaused(!userPaused));
try{sound.enabled=localStorage.getItem('shelly-range-sound')!=='off';}catch{}
$('#sound').setAttribute('aria-pressed',String(sound.enabled));$('#sound').addEventListener('click',()=>{sound.setEnabled(!sound.enabled);if(!active())sound.pause();$('#sound').setAttribute('aria-pressed',String(sound.enabled));try{localStorage.setItem('shelly-range-sound',sound.enabled?'on':'off');}catch{}});
function resetTargets(){for(const t of targets){t.health=100;t.alive=true;t.respawn=0;t.group.visible=true;t.group.scale.setScalar(1);t.hpGroup.visible=false;}player.ammo=3;player.reload=0;player.hits=player.kills=player.shots=0;pellets.forEach(p=>scene.remove(p.mesh));pellets.length=0;toast(words.reset);updateHud();}
$('#reset').addEventListener('click',resetTargets);
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape','KeyP'].includes(e.code))e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)setPaused(!userPaused);return;}if(!active())return;input.keys.add(e.code);if(e.code==='Space')sound.unlock();});
window.addEventListener('keyup',e=>input.keys.delete(e.code));
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),aimPoint=new THREE.Vector3();
function pointerAim(e){mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(mouse,camera);if(raycaster.ray.intersectPlane(groundPlane,aimPoint)){input.aim.x=aimPoint.x-player.x;input.aim.z=aimPoint.z-player.z;input.pointerAim=true;}}
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&active())pointerAim(e);});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||!active())return;e.preventDefault();pointerAim(e);input.fire=true;sound.unlock();renderer.domElement.setPointerCapture(e.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>input.fire=false);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
function bindStick(selector,fire){const el=$(selector),knob=el.querySelector('i');let pointer=null;const update=e=>{const r=el.getBoundingClientRect(),max=r.width*.31,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),factor=d>max?max/d:1;knob.style.transform=`translate(${dx*factor}px,${dy*factor}px)`;if(fire){input.stickAim=d>12;if(input.stickAim){input.aim.x=dx;input.aim.z=dy;input.pointerAim=false;}}else{input.move.x=dx*factor/max;input.move.z=dy*factor/max;}};el.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();pointer=e.pointerId;el.setPointerCapture(pointer);sound.unlock();if(fire)input.fire=true;update(e);});el.addEventListener('pointermove',e=>{if(pointer===e.pointerId)update(e);});const stop=e=>{if(pointer!==e.pointerId)return;pointer=null;knob.style.transform='';if(fire){input.fire=false;input.stickAim=false;}else input.move.x=input.move.z=0;};for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,stop);}
bindStick('#move-stick',false);bindStick('#fire-stick',true);
$('#fire-stick').addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&active()){e.preventDefault();sound.unlock();input.keys.add('Space');}});$('#fire-stick').addEventListener('keyup',()=>input.keys.delete('Space'));
function nearestTarget(){let best=null,distance=Infinity;for(const t of targets){const d=Math.hypot(t.x-player.x,t.z-player.z);if(t.alive&&d<distance&&d<10){best=t;distance=d;}}return best;}
function spawnParticles(x,y,z,count,color){for(let i=0;i<count;i++){const o=new THREE.Mesh(particleGeo,new THREE.MeshBasicMaterial({color}));o.position.set(x,y,z);scene.add(o);particles.push({mesh:o,v:new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4),life:.3+Math.random()*.3,max:.6});}}
function damageNumber(t,damage){const el=document.createElement('div');el.className='damage-number';el.textContent=damage;$('#damage-layer').append(el);numbers.push({el,x:t.x,z:t.z,y:1.7,life:.7});}
function hitTarget(t,pellet){if(!t.alive)return;t.health-=14;t.flash=.13;t.wobble=.2;t.hpGroup.visible=true;player.hits++;sound.hit();spawnParticles(pellet.mesh.position.x,.95,pellet.mesh.position.z,4,'#ffdd77');damageNumber(t,14);if(t.health<=0){t.alive=false;t.group.visible=false;t.respawn=3.2;player.kills++;sound.destroy();spawnParticles(t.x,1,t.z,20,'#f6d183');toast(words.kill);}}
function shoot(){if(player.cooldown>0)return;if(player.ammo<=0){player.cooldown=.18;return;}player.ammo--;player.cooldown=.44;player.shots++;sound.shoot();shake=.07;
 const dir=player.aim,start=new THREE.Vector3(player.x,0,player.z).addScaledVector(dir,.86);start.y=.88;
 for(const d of pelletDirections(dir.x,dir.z)){const o=new THREE.Mesh(pelletGeo,pelletMat);o.position.copy(start);scene.add(o);pellets.push({mesh:o,v:new THREE.Vector3(d.x,0,d.z).multiplyScalar(31),life:.29});}
 flash.position.copy(start);flash.rotation.y=Math.atan2(dir.x,dir.z);flash.visible=true;flashTime=.055;
 if(actions.Attack){actions.Attack.reset().setLoop(THREE.LoopOnce,1);actions.Attack.clampWhenFinished=true;actions.Attack.enabled=true;actions.Attack.setEffectiveWeight(1);actions.Attack.play();baseAction?.setEffectiveWeight(0);attackLeft=.36;}
 updateHud();}
function updateHud(){hud.dataset.x=player.x.toFixed(3);hud.dataset.z=player.z.toFixed(3);hud.dataset.shots=player.shots;hud.dataset.hits=player.hits;hud.dataset.kills=player.kills;hud.dataset.active=String(active());hud.dataset.ammo=player.ammo;$('#hit-count').textContent=player.hits;$('#target-count').textContent=player.kills;$('#ammo-state').textContent=player.ammo<3?`${words.reload} ${Math.max(0,1.25-player.reload).toFixed(1)}`:'3 / 3';$('#ammo').querySelectorAll('i').forEach((o,i)=>o.classList.toggle('empty',i>=player.ammo));}
function locomotion(moving){const next=moving?actions.Walk:actions.Idle;if(!next||next===baseAction)return;const old=baseAction;baseAction=next;next.reset().play();next.setEffectiveWeight(attackLeft>0?0:1);if(old){if(attackLeft>0)old.stop();else old.crossFadeTo(next,.13,false);} }
let stepClock=0,hudClock=0;
function simulation(dt){elapsed+=dt;player.cooldown=Math.max(0,player.cooldown-dt);if(player.ammo<3){player.reload+=dt;if(player.reload>=1.25){player.ammo++;player.reload-=1.25;sound.reload();}}else player.reload=0;
 let mx=input.move.x+(input.keys.has('KeyD')||input.keys.has('ArrowRight')?1:0)-(input.keys.has('KeyA')||input.keys.has('ArrowLeft')?1:0),mz=input.move.z+(input.keys.has('KeyS')||input.keys.has('ArrowDown')?1:0)-(input.keys.has('KeyW')||input.keys.has('ArrowUp')?1:0);const move=normalize2(mx,mz),moving=Math.hypot(move.x,move.z)>.08;
 const next=movePlayer(player,move.x*player.speed*dt,move.z*player.speed*dt,player.radius,obstacles);player.x=next.x;player.z=next.z;actor.position.set(player.x,0,player.z);
 const autofire=input.keys.has('Space')||(touch&&input.fire&&!input.stickAim);const nearest=autofire?nearestTarget():null;
 if(input.pointerAim&&!input.stickAim&&!autofire){raycaster.setFromCamera(mouse,camera);if(raycaster.ray.intersectPlane(groundPlane,aimPoint)){input.aim.x=aimPoint.x-player.x;input.aim.z=aimPoint.z-player.z;}}
 let ax=nearest?nearest.x-player.x:input.aim.x,az=nearest?nearest.z-player.z:input.aim.z;if(!input.pointerAim&&!input.stickAim&&!autofire&&moving){ax=move.x;az=move.z;}if(Math.hypot(ax,az)>.05)player.aim.set(ax,0,az).normalize();
 player.yaw=Math.atan2(player.aim.x,player.aim.z);actor.rotation.y=player.yaw;aimGuide.position.set(player.x,0,player.z);aimGuide.rotation.y=player.yaw;const aimDistance=Math.min(8.4,Math.max(1,Math.hypot(input.aim.x,input.aim.z)));crosshair.position.set(player.x+player.aim.x*(input.pointerAim?aimDistance:8.2),.02,player.z+player.aim.z*(input.pointerAim?aimDistance:8.2));
 if(input.fire||input.keys.has('Space'))shoot();
 locomotion(moving);if(attackLeft>0){attackLeft-=dt;if(attackLeft<=0){actions.Attack?.stop();baseAction?.setEffectiveWeight(1);}}
 mixer?.update(dt);stepClock+=dt;if(moving&&stepClock>.28){sound.step();stepClock=0;}
 for(let i=pellets.length-1;i>=0;i--){const p=pellets[i],from=p.mesh.position.clone(),to=from.clone().addScaledVector(p.v,dt);let collision=null,best=1;
  for(const t of targets){if(!t.alive)continue;const hit=segmentCircle(from.x,from.z,to.x,to.z,t.x,t.z,.50);if(hit!==null&&hit<=best){best=hit;collision=t;}}
  for(const b of obstacles){const hit=segmentBox(from.x,from.z,to.x,to.z,b);if(hit!==null&&hit<=best){best=hit;collision='cover';}}
  p.mesh.position.copy(from).lerp(to,best);p.life-=dt;if(collision||p.life<=0){if(collision&&collision!=='cover')hitTarget(collision,p);else if(collision)spawnParticles(p.mesh.position.x,.9,p.mesh.position.z,3,'#bf8c58');scene.remove(p.mesh);pellets.splice(i,1);} }
 for(const t of targets){if(!t.alive){t.respawn-=dt;if(t.respawn<=0){t.alive=true;t.health=100;t.group.visible=true;t.hpGroup.visible=false;}}t.flash=Math.max(0,t.flash-dt);t.wobble=Math.max(0,t.wobble-dt);t.group.rotation.z=t.wobble>0?Math.sin(t.wobble*65)*t.wobble*.18:0;t.hpMesh.scale.x=Math.max(0,t.health/100);t.hpGroup.quaternion.copy(camera.quaternion);if(t.flash>0)t.torso.material=yellow;else t.torso.material=t.id%2?leaf:woodLight;}
 hudClock+=dt;if(hudClock>.08){updateHud();hudClock=0;}
}
function visualUpdate(dt){flashTime-=dt;if(flashTime<=0)flash.visible=false;for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=9*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*7;p.mesh.scale.setScalar(Math.max(0,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);p.mesh.material.dispose();particles.splice(i,1);}}
 for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.life-=dt;n.y+=dt*1.25;const v=new THREE.Vector3(n.x,n.y,n.z).project(camera);n.el.style.left=`${(v.x*.5+.5)*innerWidth}px`;n.el.style.top=`${(-v.y*.5+.5)*innerHeight}px`;n.el.style.opacity=Math.min(1,n.life*3);if(n.life<=0){n.el.remove();numbers.splice(i,1);}}
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function positionCamera(dt,instant=false){const dest=new THREE.Vector3(player.x*.65,0,player.z-1.6);cameraTarget.lerp(dest,instant?1:1-Math.exp(-dt*5));const portrait=camera.aspect<.8,distance=portrait?19:15.8;camera.position.set(cameraTarget.x,cameraTarget.y+distance,cameraTarget.z+distance*.80);if(shake>0&&active()){camera.position.x+=(Math.random()-.5)*shake;camera.position.z+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*.8);}camera.lookAt(cameraTarget.x,0,cameraTarget.z);}
positionCamera(0,true);updateHud();
new GLTFLoader().load(modelURL,gltf=>{model=gltf.scene;model.scale.setScalar(.46);actor.add(model);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});mixer=new THREE.AnimationMixer(model);for(const clip of gltf.animations)actions[clip.name]=mixer.clipAction(clip);baseAction=actions.Idle;baseAction?.play();mixer.update(0);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);model.position.y-=bounds.min.y;loaded=true;document.body.dataset.ready='true';$('#start').disabled=false;$('#start-text').textContent=words.start;platform.markReady();updateHud();},undefined,error=>{console.error(error);$('#start-text').textContent=english?'RELOAD':'ПЕРЕЗАГРУЗИТЬ';$('#card-description').textContent=english?'Shelly could not be loaded. Reload and try again.':'Не удалось загрузить Шелли. Перезагрузи страницу и попробуй ещё раз.';$('#start').disabled=false;$('#start').onclick=()=>location.reload();});
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.12);previous=now;if(!externalPaused){if(active()){for(let remaining=dt;remaining>0;){const step=Math.min(remaining,1/60);simulation(step);remaining-=step;}visualUpdate(dt);}else if(loaded&&!started)mixer?.update(dt);positionCamera(dt);renderer.render(scene,camera);}});
window.addEventListener('pagehide',()=>{sound.pause();platform.setGameplay(false);});
}
boot().catch(error=>console.error('Arena initialization failed',error));
