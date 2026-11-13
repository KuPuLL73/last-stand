import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {getSteveWeapon} from '../steve-weapons.js';
// Real shop/reload/launch, then deliberately stationary durable targets isolate
// a single real shot. This is not a claim of a naturally occurring encounter.
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};let context,page;
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack});console.log('FAIL',name,error.message);}};
async function fresh(viewport){
 context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<900,isMobile:viewport.width<900,locale:'ru-RU'});
 await context.addInitScript(()=>{if(sessionStorage.getItem('extra-arsenal-seeded'))return;localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','off');localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:10000,ownedWeapons:['wooden-sword'],weapon:'wooden-sword'}));sessionStorage.setItem('extra-arsenal-seeded','1');});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:5190/survival.html');await ready();
}
async function ready(){await page.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__survivalTest?.lobby&&!document.querySelector('#start').disabled,null,{timeout:60000});}
async function purchaseBoth(equipped){
 await page.locator('[data-panel="shop"]').click();await page.locator('[data-buy-weapon="snow-caster"]').click();await page.locator('[data-buy-weapon="tide-trident"]').click();
 if(equipped==='snow-caster')await page.locator('[data-buy-weapon="snow-caster"]').click();
 await page.locator('#panel-close').click();await page.reload();await ready();
 const saved=await page.evaluate(()=>({profile:structuredClone(window.__survivalTest.lobby.profile),weapon:window.__survivalTest.run.weaponId,held:window.__survivalTest.steve.weaponId}));
 assert.equal(saved.profile.wallet,10000-getSteveWeapon('snow-caster').price-getSteveWeapon('tide-trident').price);assert.equal(saved.weapon,equipped);assert.equal(saved.held,equipped);
 assert.ok(saved.profile.ownedWeapons.includes('snow-caster')&&saved.profile.ownedWeapons.includes('tide-trident'));
 await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await page.waitForFunction(()=>window.__survivalTest.run.state.phase==='playing');return saved;
}
async function arrange(kind){
 await page.evaluate(kind=>{
  const t=window.__survivalTest,r=t.run,s=r.state,p=s.player;r.obstacles=[];r._spawnClock=99999;r._nextBonusAt=99999;s.enemies=[];s.drops=[];s.projectiles=[];s.warnings=[];p.x=-3.5;p.z=0;p.cooldown=0;
  const positions=kind==='snowball'?[-7]:[-4,-6,-8];window.__extraTargets=positions.map(z=>{const e=r._spawnEnemy('walker',p.x,z,null);Object.assign(e,{hp:1000,maxHp:1000,speed:0,damage:0,xp:0,attackCooldown:9999});return e.id;});
  window.__extraShotEvents=[];const emit=r._event.bind(r);r._event=(type,data={})=>{if(type==='rangedshot'){window.__extraShotEvents.push({...data});p.cooldown=99999;}emit(type,data);};
  window.__extraBatchSeen=0;const sample=()=>{window.__extraBatchSeen=Math.max(window.__extraBatchSeen,kind==='snowball'?t.enemies.snowballs.count:t.enemies.tridents.count);requestAnimationFrame(sample);};requestAnimationFrame(sample);
 },kind);
 await page.waitForFunction(()=>window.__extraBatchSeen>0);
}
try{
 await check('1280px snowball purchase and equipment survive reload with the existing wallet',async()=>{await fresh({width:1280,height:800});observations.snowPurchase=await purchaseBoth('snow-caster');});
 await check('real snowball projectile renders in its batch and applies the advertised slow to a real target',async()=>{
  await arrange('snowball');await page.waitForFunction(()=>window.__survivalTest.run.state.enemies.find(e=>e.id===window.__extraTargets[0]).slowTime>0);
  const state=await page.evaluate(()=>{const t=window.__survivalTest,e=t.run.state.enemies.find(e=>e.id===window.__extraTargets[0]);return{batch:window.__extraBatchSeen,slowTime:e.slowTime,strength:e.slowStrength,hp:e.hp,held:t.steve.root.userData.heldWeapon,event:window.__extraShotEvents[0]};});
  assert.ok(state.batch>0&&state.hp<1000&&state.slowTime>0);assert.equal(state.strength,getSteveWeapon('snow-caster').slowStrength);assert.equal(state.held,'snow-caster');assert.equal(state.event.kind,'snowball');observations.snow=state;
  await page.screenshot({path:'game/artifacts/extra-snowball-gameplay.png'});
 });await context.close();context=null;
 await check('390px thrown trident purchase and equipment survive reload',async()=>{await fresh({width:390,height:844});observations.tridentPurchase=await purchaseBoth('tide-trident');});
 await check('real thrown trident renders and pierces a second target with reduced damage',async()=>{
  await arrange('trident');await page.waitForFunction(()=>window.__survivalTest.run.state.enemies.find(e=>e.id===window.__extraTargets[1]).hp<1000);
  const state=await page.evaluate(()=>({batch:window.__extraBatchSeen,hp:window.__extraTargets.map(id=>window.__survivalTest.run.state.enemies.find(e=>e.id===id).hp),held:window.__survivalTest.steve.root.userData.heldWeapon,event:window.__extraShotEvents[0]}));
  const w=getSteveWeapon('tide-trident');assert.ok(state.batch>0);assert.ok(Math.abs((1000-state.hp[0])-w.damage)<1e-6);assert.ok(Math.abs((1000-state.hp[1])-w.damage*w.penetrationFalloff)<1e-6);assert.equal(state.hp[2],1000);assert.equal(state.held,'tide-trident');assert.equal(state.event.kind,'trident');observations.trident=state;
  await page.screenshot({path:'game/artifacts/extra-trident-gameplay-390.png'});
 });
 await check('no runtime, texture or shader errors in real gameplay',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/extra-arsenal-gameplay-results.json',JSON.stringify({results,errors,observations},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
