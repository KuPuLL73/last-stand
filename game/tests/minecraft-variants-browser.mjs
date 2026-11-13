import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[];
const context=await browser.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:1}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}};
try{
 await page.goto('http://127.0.0.1:5190/game/artifacts/minecraft-variants-preview.html');
 await page.waitForFunction(()=>window.__variantPreview?.mobs.textures.every(texture=>texture.image?.width>0));
 await check('All four post-boss variant entities select their own textured model',async()=>{
  const report=await page.evaluate(()=>{const {mobs,run}=window.__variantPreview;return{keys:Object.keys(mobs.types),variants:run.state.enemies.filter(e=>e.variant).map(e=>e.variant),counts:Object.fromEntries(Object.entries(mobs.types).map(([id,spec])=>[id,spec.count])),images:mobs.textures.map(t=>t.image.currentSrc)}});
  assert.ok(report.keys.length>=16);assert.deepEqual(report.variants.sort(),['cave-spider','drowned','husk','stray']);
  for(const key of report.variants)assert.equal(report.counts[key],1);
  for(const fragment of ['zombie-husk','zombie-drowned','skeleton-stray','spider-cave_spider'])assert.ok(report.images.some(url=>url.includes(fragment)),fragment);
 });
 await check('Drowned shell and stray clothing follow animated limb transforms exactly',async()=>{
  const report=await page.evaluate(()=>{const v=window.__variantPreview;v.setFrozen(true);const results=[];for(const time of [0,.17,.43]){v.setTime(time);for(const id of ['stray','drowned']){const spec=v.mobs.types[id];for(const name of ['body','head','rightArm','leftArm','rightLeg','leftLeg']){const b=spec.bones[name],base=Array.from(b.mesh.instanceMatrix.array.slice(0,16));results.push({id,name,time,count:b.layers.length,matches:b.layers.every(layer=>layer.count===1&&base.every((n,i)=>n===layer.instanceMatrix.array[i]))});}}}return results;});
  assert.equal(report.length,36);assert.ok(report.every(r=>r.count===1&&r.matches),JSON.stringify(report));
  assert.equal(await page.evaluate(()=>window.__variantPreview.mobs.bow.count),2);
 });
 await check('Cave spider is the smaller species and keeps eight grounded animated legs',async()=>{
  const report=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js'),v=window.__variantPreview,spec=v.mobs.types['cave-spider'];const e=v.run.state.enemies.find(e=>e.variant==='cave-spider');e.x=e.z=0;const heights=[];for(const time of [0,.1,.2,.3,.4,.5]){v.mobs.update([e],time);for(const[name,b]of Object.entries(spec.bones)){if(!name.startsWith('leg'))continue;const m=new THREE.Matrix4();b.mesh.getMatrixAt(0,m);const attr=b.mesh.geometry.attributes.position,p=new THREE.Vector3(),ys=[];for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(m);if(Math.hypot(p.x,p.z)>.45)ys.push(p.y);}heights.push({name,min:Math.min(...ys),max:Math.max(...ys)});}}return{ratio:spec.scale/v.mobs.types.runner.scale,heights};});
  assert.ok(Math.abs(report.ratio-.7)<1e-8);assert.equal(report.heights.length,48);assert.ok(report.heights.every(h=>h.min>-.07&&h.max<.23),JSON.stringify(report));
 });
 await check('Mixed variants share one total 80-mob render budget and clear unused batches',async()=>{
  const report=await page.evaluate(()=>{const v=window.__variantPreview,variants=['husk','drowned','stray','cave-spider'],types={husk:'walker',drowned:'walker',stray:'spitter','cave-spider':'runner'};v.mobs.update(Array.from({length:160},(_,i)=>({id:i+1,type:types[variants[i%4]],variant:variants[i%4],x:0,z:0,hp:100,angle:0})),0);const total=Object.values(v.mobs.types).reduce((sum,s)=>sum+s.count,0);v.mobs.update([],0);return{total,remaining:Object.values(v.mobs.types).reduce((sum,s)=>sum+s.count,0),bows:v.mobs.bow.count};});
  assert.equal(report.total,80);assert.equal(report.remaining,0);assert.equal(report.bows,0);
 });
 await page.reload();await page.waitForFunction(()=>window.__variantPreview?.mobs.textures.every(t=>t.image?.width>0));await page.evaluate(()=>window.__variantPreview.setFrozen(true));await page.screenshot({path:'game/artifacts/minecraft-variants-final.png'});
 await check('No runtime, texture or shader errors in the textured variant scene',()=>assert.deepEqual(errors,[]));
}finally{await context.close();await browser.close();await writeFile('game/artifacts/minecraft-variants-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
