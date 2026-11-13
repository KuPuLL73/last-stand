import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const directory=fileURLToPath(new URL('../artifacts/',import.meta.url)),types=['heal','haste','rapid','shield','magnet'];
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];let modelReport;
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}}
try{
 const page=await browser.newPage({viewport:{width:1280,height:760},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:5190/game/artifacts/boost-gemini-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await check('All five concept meshes are finite, coloured volumes within the shared prop size/budget',async()=>{
  modelReport=await page.evaluate(()=>window.__boostGeminiPreview.scenes.map(scene=>{const group=scene.children.find(c=>c.isGroup),mesh=group.children[0],g=mesh.geometry,b=g.boundingBox;return{name:g.name,vertices:g.attributes.position.count,triangles:g.attributes.position.count/3,colours:g.attributes.color.count,size:[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z],finite:Array.from(g.attributes.position.array).every(Number.isFinite),auraTriangles:group.children[1]?.geometry.attributes.position.count/3||0};}));
  assert.equal(modelReport.length,5);const vertexCounts=new Set();for(const model of modelReport){assert.ok(model.finite);assert.ok(model.size.every(n=>n>.15));assert.ok(Math.abs(Math.max(...model.size)-1.08)<.001);assert.equal(model.vertices,model.colours);assert.ok(model.triangles<2300);vertexCounts.add(model.vertices);}assert.equal(vertexCounts.size,5);assert.equal(modelReport[3].auraTriangles,24);
 });
 await page.screenshot({path:directory+'boost-gemini-models.png'});
 await check('Every HUD asset is a transparent 256px export',async()=>{for(const type of types){const bytes=await readFile(new URL(`../assets/boosts/${type}.png`,import.meta.url));assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),256);assert.equal(bytes[25],6);}});
 await page.goto('http://127.0.0.1:5190/game/artifacts/loot-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await check('Real world renderer uses five instanced props and one aligned shield shell batch',async()=>{
  const report=await page.evaluate(()=>{const v=window.__lootPreview.visual,matrix=v._dummy.matrix.clone(),auraMatrix=matrix.clone();v.pickups.shield.getMatrixAt(0,matrix);v.pickupAuras.shield.getMatrixAt(0,auraMatrix);return{counts:Object.fromEntries(Object.entries(v.pickups).map(([k,m])=>[k,m.count])),instanced:Object.values(v.pickups).every(m=>m.isInstancedMesh),auraKeys:Object.keys(v.pickupAuras),auraCount:v.pickupAuras.shield.count,aligned:matrix.equals(auraMatrix),auraTransparent:v.pickupAuras.shield.material.transparent,depthWrite:v.pickupAuras.shield.material.depthWrite,calls:window.__lootPreview.drawCalls()};});
  assert.deepEqual(report.counts,Object.fromEntries(types.map(t=>[t,1])));assert.equal(report.instanced,true);assert.deepEqual(report.auraKeys,['shield']);assert.equal(report.auraCount,1);assert.equal(report.aligned,true);assert.equal(report.auraTransparent,true);assert.equal(report.depthWrite,false);assert.ok(report.calls<24);
 });
 await check('Shield glass obeys drop capacity, expiry blink and removal without stale instances',async()=>{
  const report=await page.evaluate(()=>{const v=window.__lootPreview.visual,frame={enemies:[],projectiles:[],drops:Array.from({length:45},(_,id)=>({id,type:'shield',x:id,z:0,life:20})),warnings:[]};v.update(frame,0,0);const capped=[v.pickups.shield.count,v.pickupAuras.shield.count];v.update({...frame,drops:[{id:0,type:'shield',x:0,z:0,life:1}]},Math.PI*1.5/13,0);const blink=[v.pickups.shield.count,v.pickupAuras.shield.count];v.update({...frame,drops:[]},0,0);return{capped,blink,removed:[v.pickups.shield.count,v.pickupAuras.shield.count]};});assert.deepEqual(report,{capped:[40,40],blink:[0,0],removed:[0,0]});
 });
 await page.waitForTimeout(100);await page.screenshot({path:directory+'boost-gemini-world.png'});
 await check('No browser or shader errors',()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile(directory+'boost-gemini-results.json',JSON.stringify({results,modelReport,errors},null,2));}
const summary={passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length};console.log(JSON.stringify(summary));if(summary.failed)process.exitCode=1;
