import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[];
const page=await browser.newPage({viewport:{width:1920,height:1800},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}};
try{
 await page.goto('http://127.0.0.1:5190/game/artifacts/minecraft-roster-preview.html');
 await page.waitForFunction(()=>window.__rosterPreview?.mobs.textures.every(t=>t.image?.width>0));
 await page.evaluate(()=>window.__rosterPreview.setFrozen(true));
 await check('All 26 real late-wave entities choose their own complete textured models',async()=>{
  const report=await page.evaluate(async()=>{const {EXTRA_MOB_IDS}=await import('/game/minecraft-roster.js'),v=window.__rosterPreview;return EXTRA_MOB_IDS.map(id=>({id,count:v.mobs.types[id]?.count,bones:v.mobs.types[id]?.parts.length,entity:v.run.state.enemies.find(e=>e.variant===id)?.type,renderType:v.mobs.types[id]?.type}));});
  assert.equal(report.length,26);assert.ok(report.every(r=>r.count===1&&r.bones>0&&r.entity===r.renderType),JSON.stringify(report));
 });
 await check('Every species stays above ground and within readable ordinary-creature bounds',async()=>{
  const report=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js'),{EXTRA_MOB_IDS}=await import('/game/minecraft-roster.js'),v=window.__rosterPreview;v.setTime(0);const out=[];for(const id of EXTRA_MOB_IDS){const spec=v.mobs.types[id],box=new THREE.Box3(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();for(const[,b]of spec.parts)for(const mesh of b.meshes){mesh.getMatrixAt(0,matrix);for(let i=0;i<mesh.geometry.attributes.position.count;i++){point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);box.expandByPoint(point);}}out.push({id,minY:box.min.y,maxY:box.max.y,height:box.max.y-box.min.y,width:box.max.x-box.min.x});}return out;});
  await writeFile('game/artifacts/minecraft-roster-bounds.json',JSON.stringify(report,null,2));
  assert.ok(report.every(r=>r.minY>-.12&&r.height>.15&&r.maxY<4.8&&r.width<5.0),JSON.stringify(report));
 });
 await check('All 26 species animate without creating per-enemy meshes',async()=>{
  const report=await page.evaluate(async()=>{const {EXTRA_MOB_IDS}=await import('/game/minecraft-roster.js'),v=window.__rosterPreview,children=v.mobs.group.children.length;v.setTime(.17);const before=Object.fromEntries(EXTRA_MOB_IDS.map(id=>[id,v.mobs.types[id].parts.map(([,b])=>Array.from(b.mesh.instanceMatrix.array.slice(0,16))).flat()]));v.setTime(.73);return EXTRA_MOB_IDS.map(id=>({id,changed:v.mobs.types[id].parts.map(([,b])=>Array.from(b.mesh.instanceMatrix.array.slice(0,16))).flat().some((n,i)=>Math.abs(n-before[id][i])>1e-6),childrenStable:children===v.mobs.group.children.length}));});
  assert.ok(report.every(r=>r.changed&&r.childrenStable),JSON.stringify(report));
 });
 await check('Original item-pixel weapons follow their actual right hands',async()=>{
  const report=await page.evaluate(()=>{const v=window.__rosterPreview;return['wither-skeleton','pillager','vindicator','witch','vex','piglin','piglin-brute','zombified-piglin'].map(id=>{const spec=v.mobs.types[id],b=spec.bones[id==='witch'?'arms':'rightArm'];return{id,attached:!!b&&b.layers.some(m=>m.name.endsWith('/equipment')),counts:b?.layers.map(m=>m.count)};});});
  assert.ok(report.every(r=>r.attached&&r.counts.every(n=>n===1)),JSON.stringify(report));
 });
 await check('Slime shell, breeze wind and glowing eyes retain real layered geometry',async()=>{
  const report=await page.evaluate(()=>{const v=window.__rosterPreview;return['slime','breeze','enderman','phantom','creaking'].map(id=>{const spec=v.mobs.types[id];return{id,meshes:spec.parts.reduce((n,[,b])=>n+b.meshes.length,0),layers:spec.parts.some(([,b])=>b.layers.length>0),transparent:spec.parts.some(([,b])=>b.meshes.some(m=>m.material.transparent))};});});
  assert.ok(report.every(r=>r.transparent&&r.meshes>2),JSON.stringify(report));
 });
 await page.evaluate(()=>window.__rosterPreview.setTime(1.2));await page.screenshot({path:'game/artifacts/minecraft-roster-final.png'});
 await check('No source-texture, runtime or GLSL errors while every hostile family is visible',()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile('game/artifacts/minecraft-roster-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
