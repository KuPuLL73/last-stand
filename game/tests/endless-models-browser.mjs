import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[];
const context=await browser.newContext({viewport:{width:1700,height:1300},deviceScaleFactor:1}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}};
const ready=()=>page.waitForFunction(()=>window.__endlessPreview&&[window.__endlessPreview.ordinary,...window.__endlessPreview.bossPools].every(p=>p.textures.every(t=>t.image?.width>0)),null,{timeout:60000});
try{
 await page.goto('http://127.0.0.1:5190/game/artifacts/endless-roster-preview.html');await ready();
 await check('Actual boss sequence restores the original golem first, then five distinct requested models',async()=>{
  const r=await page.evaluate(()=>{const v=window.__endlessPreview;return{variants:v.run.state.enemies.filter(e=>e.variant).map(e=>e.variant),bosses:v.bosses.map(e=>e.bossVariant),counts:v.bossPools.map(p=>Object.fromEntries(Object.entries(p.types).map(([id,s])=>[id,s.count]))),equipment:Object.fromEntries(['armored-zombie','armored-skeleton'].map(id=>[id,v.ordinary.types[id].parts.filter(([,b])=>b.meshes.some(m=>m.name.endsWith('/equipment'))).map(([n])=>n)]))};});
  assert.ok(r.variants.includes('armored-zombie'));assert.ok(r.variants.includes('armored-skeleton'));
  assert.deepEqual(r.bosses,['iron-golem','wither','warden','elder-guardian','zombie-brute','ender-dragon']);for(const[i,id]of r.bosses.entries())assert.equal(r.counts[i][id],1);
  for(const names of Object.values(r.equipment))assert.deepEqual(names.sort(),['body','head','leftArm','leftLeg','rightArm','rightLeg'].sort());
 });
 await check('Armour, Warden glow and brute torn-shirt patches remain attached to animated joints',async()=>{
  const matches=await page.evaluate(()=>{const v=window.__endlessPreview;v.setFrozen(true);const matches=[];for(const t of [0,.22,.47]){v.setTime(t);for(const[pool,id]of [[v.ordinary,'armored-zombie'],[v.ordinary,'armored-skeleton'],[v.bossPools[2],'warden'],[v.bossPools[4],'zombie-brute']])for(const[name,b]of pool.types[id].parts){const base=b.mesh.instanceMatrix.array;for(const gear of b.layers)matches.push({id,name,t,attached:gear.count===1&&Array.from(base.slice(0,16)).every((n,i)=>n===gear.instanceMatrix.array[i])});}}return matches;});
  assert.ok(matches.length>50);assert.ok(matches.every(m=>m.attached),JSON.stringify(matches));
 });
 await check('Wither has three heads; Guardian has a front eye, twelve separate spikes and articulated tail',async()=>{
  const r=await page.evaluate(()=>{const v=window.__endlessPreview,w=v.bossPools[1].types.wither,g=v.bossPools[3].types['elder-guardian'];return{heads:w.parts.filter(([n])=>/^head[123]$/.test(n)).map(([n])=>n),spikes:g.parts.filter(([n])=>n.startsWith('spikepart')).map(([n,b])=>({name:n,position:Array.from(b.mesh.instanceMatrix.array.slice(12,15))})),tails:g.parts.filter(([n])=>n.startsWith('tailpart')).length,eye:g.bones.eye.mesh.count};});
  assert.equal(r.heads.length,3);assert.equal(r.spikes.length,12);assert.equal(new Set(r.spikes.map(s=>s.position.map(n=>n.toFixed(2)).join(','))).size,12);assert.equal(r.tails,3);assert.equal(r.eye,1);
 });
 await check('Dragon has four wing sections, five neck sections and twelve tail sections within seven metres',async()=>{
  const r=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js'),v=window.__endlessPreview,pool=v.bossPools[5],e=v.bosses[5],spec=pool.types['ender-dragon'];e.x=e.z=0;const widths=[];for(const t of [0,.2,.4,.6,.8]){pool.update([e],t);let min=Infinity,max=-Infinity;for(const[name,b]of spec.parts){if(!name.startsWith('wing'))continue;const m=new THREE.Matrix4();b.mesh.getMatrixAt(0,m);const a=b.mesh.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(m);min=Math.min(min,p.x);max=Math.max(max,p.x);}}widths.push(max-min);}return{wings:spec.parts.filter(([n])=>n.startsWith('wing')).length,neck:spec.parts.filter(([n])=>n.startsWith('neck')).length,tail:spec.parts.filter(([n])=>n.startsWith('tail')).length,widths};});
  assert.equal(r.wings,4);assert.equal(r.neck,5);assert.equal(r.tail,12);assert.ok(r.widths.every(w=>w>5&&w<7.1),JSON.stringify(r));assert.ok(Math.max(...r.widths)-Math.min(...r.widths)>.1);
 });
 await check('Reference zombie brute has a genuinely broad chest and parented forearms',async()=>{
  const r=await page.evaluate(()=>{const s=window.__endlessPreview.bossPools[4].types['zombie-brute'],body=s.bones.body.mesh.geometry,head=s.bones.head.mesh.geometry;body.computeBoundingBox();head.computeBoundingBox();return{ratio:(body.boundingBox.max.x-body.boundingBox.min.x)/(head.boundingBox.max.x-head.boundingBox.min.x),parents:['rightForearm','leftForearm'].map(n=>s.bones[n].parent.name),healthHeight:s.healthHeight};});
  assert.ok(r.ratio>3);assert.deepEqual(r.parents,['rightArm','leftArm']);assert.ok(r.healthHeight>3);
 });
 await check('All biped leg textures are opaque on both sides, including the legacy-layout husk regression',async()=>{
  const report=await page.evaluate(()=>{const v=window.__endlessPreview,pool=v.ordinary,report=[];for(const[id,s]of Object.entries(pool.types)){
   let pair=[s.bones.rightLeg,s.bones.leftLeg];if(!pair.every(Boolean))pair=[s.bones.right_leg,s.bones.left_leg];if(!pair.every(Boolean))pair=[s.bones.leg0,s.bones.leg1];if(!pair.every(Boolean))continue;
   for(const[side,b]of pair.entries()){const texture=b.mesh.material.map;if(!texture?.image)continue;const image=texture.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,uv=b.mesh.geometry.attributes.uv;let opaque=0,total=0;
    for(let i=0;i<uv.count;i+=4){let u=0,w=0;for(let j=0;j<4;j++){u+=uv.getX(i+j)/4;w+=uv.getY(i+j)/4;}const x=Math.min(c.width-1,Math.max(0,Math.floor(u*c.width))),y=Math.min(c.height-1,Math.max(0,Math.floor((1-w)*c.height)));total++;if(pixels[(y*c.width+x)*4+3]>127)opaque++;}
    report.push({id,side,opaque,total});
   }
  }return report;});
  assert.ok(report.filter(r=>r.id==='husk').length===2);assert.ok(report.every(r=>r.opaque>=Math.min(4,r.total)),JSON.stringify(report.filter(r=>r.opaque<Math.min(4,r.total))));
 });
 await check('Both legs keep distinct animated joints through complete biped walk cycles',async()=>{
  const report=await page.evaluate(()=>{const p=window.__endlessPreview.ordinary,report=[];for(const id of ['walker','husk','drowned','spitter','stray','armored-zombie','armored-skeleton','warden','zombie-brute']){const s=p.types[id],pair=s.bones.rightLeg?[s.bones.rightLeg,s.bones.leftLeg]:[s.bones.right_leg,s.bones.left_leg];for(const time of [0,.15,.30,.45,.60,.75,.90]){p.update([{id:20,type:s.type,variant:s.type==='boss'?undefined:id,bossVariant:s.type==='boss'?id:undefined,x:0,z:0,hp:100,angle:0}],time);const a=pair[0].mesh.instanceMatrix.array,b=pair[1].mesh.instanceMatrix.array;report.push({id,time,leftCount:pair[0].mesh.count,rightCount:pair[1].mesh.count,distance:Math.hypot(a[12]-b[12],a[13]-b[13],a[14]-b[14]),finite:Array.from(a.slice(0,16)).every(Number.isFinite)&&Array.from(b.slice(0,16)).every(Number.isFinite)});}}return report;});
  assert.equal(report.length,63);assert.ok(report.every(r=>r.leftCount===1&&r.rightCount===1&&r.distance>.1&&r.finite),JSON.stringify(report.filter(r=>r.distance<=.1||!r.finite)));
 });
 await check('Mixed armies retain global 80 ordinary / 2 boss limits and honour split-mob geometry scale',async()=>{
  const r=await page.evaluate(()=>{const p=window.__endlessPreview.ordinary,list=Array.from({length:100},(_,i)=>({id:i+1,type:i%2?'walker':'spitter',variant:i%2?'armored-zombie':'armored-skeleton',x:0,z:0,hp:100}));list.push(...['iron-golem','wither','warden','elder-guardian','ender-dragon'].map((bossVariant,i)=>({id:200+i,type:'boss',bossVariant,x:0,z:0,hp:100})));p.update(list,1);const counts=Object.values(p.types).reduce((a,s)=>(a[s.type==='boss'?'boss':'ordinary']+=s.count,a),{boss:0,ordinary:0});p.update([{id:500,type:'walker',variant:'armored-zombie',hp:100,x:0,z:0,modelScale:.5}],1);const m=p.types['armored-zombie'].bones.body.mesh.instanceMatrix.array,scale=Math.hypot(m[0],m[1],m[2]);p.update([],1);return{counts,scale,expected:p.types['armored-zombie'].scale*.5,remaining:Object.values(p.types).reduce((a,s)=>a+s.count,0),bows:p.bow.count};});
  assert.deepEqual(r.counts,{boss:2,ordinary:80});assert.ok(Math.abs(r.scale-r.expected)<1e-6);assert.equal(r.remaining,0);assert.equal(r.bows,0);
 });
 await page.reload();await ready();await page.evaluate(()=>window.__endlessPreview.setFrozen(true));await page.screenshot({path:'game/artifacts/endless-roster-final.png'});
 await page.setViewportSize({width:1280,height:720});await page.goto('http://127.0.0.1:5190/game/artifacts/husk-leg-preview.html');await page.waitForFunction(()=>window.__huskPreview?.mobs.textures.every(t=>t.image?.width>0));await page.screenshot({path:'game/artifacts/husk-legs-fixed.png'});
 await check('No model, texture, runtime or GPU shader errors',()=>assert.deepEqual(errors,[]));
}finally{await context.close();await browser.close();await writeFile('game/artifacts/endless-models-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
