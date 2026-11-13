import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[],observations={};
let context;
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}};
async function fresh(size={width:1280,height:800},query=''){
 context=await browser.newContext({viewport:size,deviceScaleFactor:1});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(`http://127.0.0.1:5190/game/artifacts/cubic-shaders-preview.html${query}`);
 await page.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__cubicShaderPreview.scene.children.every(o=>!o.material?.map||o.material.map.image?.width>0));
 await page.evaluate(()=>window.__cubicShaderPreview.setFrozen(true));return page;
}
try{
 const p=await fresh();
 await check('Scene materials compile with original crisp block textures and one dust draw',async()=>{
  const report=await p.evaluate(()=>{const v=window.__cubicShaderPreview;return{state:v.state(),textures:v.scene.children.filter(o=>o.material?.map).map(o=>({name:o.name,nearest:o.material.map.magFilter===1003,compiled:!!o.material.userData.cubicCompiled})),water:v.scene.getObjectByName('Forest pond').material.userData.cubicEffect};});
  observations.desktop=report.state;assert.ok(report.state.compiled>=10,JSON.stringify(report.state));assert.equal(report.state.motes,26);assert.equal(report.state.addedDrawCalls,1);assert.equal(report.water.kind,'water');assert.ok(report.textures.every(t=>t.nearest));assert.ok(report.state.calls<160,report.state.calls);
  await p.screenshot({path:'game/artifacts/cubic-shaders-gameplay.png'});
 });
 await check('Wind and water share active time while solid block geometry stays unchanged',async()=>{
  const report=await p.evaluate(()=>{const v=window.__cubicShaderPreview,blocks=v.scene.children.filter(o=>o.name==='Minecraft blocks'),before=blocks.map(o=>Array.from(o.instanceMatrix.array)),t=v.state().time;v.advance(2);return{before,after:blocks.map(o=>Array.from(o.instanceMatrix.array)),elapsed:v.state().time-t,waterTime:v.scene.getObjectByName('Forest pond').material.userData.cubicCompiled};});
  assert.deepEqual(report.after,report.before);assert.ok(report.elapsed>1.99);
 });
 await check('Pond ripples visibly animate without moving the water plane',async()=>{
  await p.evaluate(()=>window.__cubicShaderPreview.view('water'));const before=await p.screenshot({path:'game/artifacts/cubic-shaders-water-a.png'});
  const a=await p.evaluate(()=>{const v=window.__cubicShaderPreview,w=v.scene.getObjectByName('Forest pond');return{vertices:Array.from(w.geometry.attributes.position.array),position:w.position.toArray(),time:v.state().time,compiled:w.material.userData.cubicCompiled};});
  await p.evaluate(()=>window.__cubicShaderPreview.advance(2));const after=await p.screenshot({path:'game/artifacts/cubic-shaders-water-b.png'});
  const b=await p.evaluate(()=>{const v=window.__cubicShaderPreview,w=v.scene.getObjectByName('Forest pond');return{vertices:Array.from(w.geometry.attributes.position.array),position:w.position.toArray(),time:v.state().time};});
  assert.ok(a.compiled);assert.deepEqual(a.vertices,b.vertices);assert.deepEqual(a.position,b.position);assert.ok(b.time>a.time+1.99);assert.notDeepEqual(before,after);
 });
 await check('World effects switch and pause stop time without changing collision landmarks',async()=>{
  const report=await p.evaluate(()=>{const v=window.__cubicShaderPreview;v.setPaused(true);const a=v.state();v.advance(2);const paused=v.state();v.setPaused(false);v.setEffects(false);const off=v.state();v.advance(2);const b=v.state();const dust=v.arena.effects.dust.visible;v.setEffects(true);v.advance(.5);return{a,paused,off,b,dust,resumed:v.state(),obstacles:v.arena.obstacles.length};});
  assert.equal(report.paused.time,report.a.time);assert.equal(report.b.time,report.off.time);assert.equal(report.off.enabled,false);assert.equal(report.dust,false);assert.ok(report.resumed.time>report.b.time+.49);assert.equal(report.obstacles,7);
 });
 await context.close();context=null;
 for(const size of [{width:390,height:844},{width:844,height:390}]){
  const p=await fresh(size,'?mobile&view=water');
  await check(`${size.width}×${size.height}: lightweight shader budget, textures and scene remain valid`,async()=>{const a=await p.evaluate(()=>window.__cubicShaderPreview.state());assert.equal(a.motes,10);assert.ok(a.mobile);assert.ok(a.compiled>=10);assert.ok(a.calls<160);await p.evaluate(()=>window.__cubicShaderPreview.advance(1));const b=await p.evaluate(()=>window.__cubicShaderPreview.state());assert.ok(b.time>a.time+.99);await p.screenshot({path:`game/artifacts/cubic-shaders-mobile-${size.width}.png`});observations[size.width]=b;});
  await context.close();context=null;
 }
 const reduced=await fresh({width:390,height:844},'?mobile&reduce&view=water');
 await check('Reduced motion keeps the textured static scene and suppresses moving layers',async()=>{const a=await reduced.evaluate(()=>window.__cubicShaderPreview.state());await reduced.evaluate(()=>window.__cubicShaderPreview.advance(3));const b=await reduced.evaluate(()=>window.__cubicShaderPreview.state());assert.equal(b.time,a.time);assert.equal(b.enabled,false);assert.equal(b.addedDrawCalls,0);assert.equal(await reduced.evaluate(()=>window.__cubicShaderPreview.arena.effects.dust.visible),false);});
 await context.close();context=null;
 for(const size of [{width:390,height:844},{width:844,height:390}]){
  context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ru-RU'});
  await context.addInitScript(()=>{localStorage.setItem('survival-map','cubic');localStorage.setItem('survival-character','steve');});
  const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message));game.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await game.goto('http://127.0.0.1:5190/survival.html');await game.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
  await check(`${size.width}×${size.height}: real endless forest animates and pause freezes scene time`,async()=>{
   await game.locator('#start').tap();await game.locator('[data-mode="endless"]').tap();await game.locator('#launch-run').tap();
   await game.waitForFunction(()=>window.__survivalTest.arena.effectsState.time>.06);
   const state=await game.evaluate(()=>({effects:window.__survivalTest.arena.effectsState,phase:window.__survivalTest.run.state.phase,map:window.__survivalTest.run.state.map,width:document.documentElement.scrollWidth}));
   assert.equal(state.phase,'playing');assert.equal(state.map,'cubic');assert.equal(state.effects.motes,10);assert.equal(state.width,size.width);
   await game.screenshot({path:`game/artifacts/cubic-shaders-actual-${size.width}.png`});
   await game.locator('#pause').tap();await game.waitForFunction(()=>window.__survivalTest.run.state.phase==='paused');const a=await game.evaluate(()=>window.__survivalTest.arena.effectsState.time);await game.waitForTimeout(240);const b=await game.evaluate(()=>window.__survivalTest.arena.effectsState.time);assert.equal(b,a);
   await game.locator('#start').tap();await game.waitForFunction(t=>window.__survivalTest.arena.effectsState.time>t+.06,b);
  });
  await context.close();context=null;
 }
 context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,locale:'ru-RU'});
 await context.addInitScript(()=>{localStorage.setItem('survival-map','cubic');localStorage.setItem('survival-character','steve');});
 const offGame=await context.newPage();offGame.on('pageerror',e=>errors.push(e.message));offGame.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await check('Actual settings switch disables world motion while normal gameplay keeps advancing',async()=>{
  await offGame.goto('http://127.0.0.1:5190/survival.html');await offGame.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});await offGame.locator('#menu-settings').click();await offGame.locator('[data-toggle="effects"]').click();await offGame.locator('#panel-close').click();
  await offGame.locator('#start').click();await offGame.locator('[data-mode="endless"]').click();await offGame.locator('#launch-run').click();await offGame.waitForFunction(()=>window.__survivalTest.run.state.phase==='playing'&&!window.__survivalTest.arena.effectsState.enabled);
  const a=await offGame.evaluate(()=>({time:window.__survivalTest.arena.effectsState.time,game:window.__survivalTest.run.state.elapsed,dust:window.__survivalTest.arena.effects.dust.visible}));await offGame.waitForTimeout(250);const b=await offGame.evaluate(()=>({time:window.__survivalTest.arena.effectsState.time,game:window.__survivalTest.run.state.elapsed}));assert.equal(b.time,a.time);assert.ok(b.game>a.game);assert.equal(a.dust,false);
 });
 await check('No runtime or GPU shader errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/cubic-shaders-results.json',JSON.stringify({results,errors,observations},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
