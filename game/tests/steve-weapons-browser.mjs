import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {STEVE_WEAPONS,getSteveWeapon} from '../steve-weapons.js';
const legacyBudget=getSteveWeapon('stone-sword').price+getSteveWeapon('iron-sword').price+500;
const legacyAfterStone=legacyBudget-getSteveWeapon('stone-sword').price,legacyAfterBoth=legacyAfterStone-getSteveWeapon('iron-sword').price;
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[];
let context,page;
async function fresh(viewport={width:1280,height:800},profile=null){
 context=await browser.newContext({viewport,locale:'ru-RU',deviceScaleFactor:1,hasTouch:viewport.width<1000,isMobile:viewport.width<1000});
 await context.addInitScript(profile=>{localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');if(profile&&!localStorage.getItem('rift-survival-profile.v1'))localStorage.setItem('rift-survival-profile.v1',JSON.stringify(profile));},profile);
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/survival.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
const info=()=>page.evaluate(()=>{const t=window.__survivalTest;return{profile:structuredClone(t.lobby.profile),weapon:structuredClone(t.run.state.player.weapon),model:t.steve.weaponId,phase:t.run.state.phase};});
try{
 await fresh();
 await check('New player starts with a real wooden sword, with seventeen honest shop choices',async()=>{
  const s=await info();assert.equal(s.profile.wallet,0);assert.deepEqual(s.profile.ownedWeapons,['wooden-sword']);assert.equal(s.weapon.id,'wooden-sword');assert.equal(s.weapon.damage,24);assert.equal(s.model,'wooden-sword');
  await page.locator('[data-panel="shop"]').click();assert.equal(STEVE_WEAPONS.length,17);assert.equal(await page.locator('.weapon-card').count(),17);
  assert.ok(await page.locator('[data-buy-weapon="stone-sword"]').isDisabled());
  for(const image of await page.locator('.weapon-card img').all())assert.ok(await image.evaluate(i=>i.complete&&i.naturalWidth>0));
  const before=await info();assert.equal(await page.evaluate(()=>window.__survivalTest.lobby.buyWeapon('netherite-axe')),false);assert.deepEqual((await info()).profile,before.profile);
  await page.screenshot({path:'game/artifacts/steve-shop-desktop.png'});
 });await context.close();
 await fresh(undefined,{wallet:legacyBudget,owned:['teal','violet'],equipped:'violet',runs:[],claims:['first'],effects:true});
 await check('Legacy profile keeps currency and cosmetics; purchases and free re-equipping persist',async()=>{
  let s=await info();assert.equal(s.profile.wallet,legacyBudget);assert.equal(s.profile.equipped,'violet');assert.equal(s.profile.weapon,'wooden-sword');
  await page.locator('[data-panel="shop"]').click();await page.locator('[data-buy-weapon="stone-sword"]').click();
  s=await info();assert.equal(s.profile.wallet,legacyAfterStone);assert.equal(s.weapon.id,'stone-sword');assert.equal(s.model,'stone-sword');assert.equal(s.weapon.damage,getSteveWeapon('stone-sword').damage);
  await page.locator('[data-buy-weapon="iron-sword"]').click();s=await info();assert.equal(s.profile.wallet,legacyAfterBoth);assert.equal(s.weapon.damage,getSteveWeapon('iron-sword').damage);
  await page.locator('[data-buy-weapon="stone-sword"]').click();assert.equal((await info()).profile.wallet,legacyAfterBoth);
  assert.equal(await page.evaluate(()=>window.__survivalTest.lobby.buyWeapon('bad-id')),false);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');s=await info();assert.equal(s.profile.wallet,legacyAfterBoth);assert.equal(s.profile.weapon,'stone-sword');assert.equal(s.model,'stone-sword');assert.equal(s.weapon.id,'stone-sword');assert.equal(s.profile.equipped,'violet');
 });await context.close();
 await fresh(undefined,{wallet:STEVE_WEAPONS.reduce((total,w)=>total+w.price,0)+100});
 await check('Every equipped weapon changes the real held model and core stats',async()=>{
  await page.locator('[data-panel="shop"]').click();const cards=await page.locator('.weapon-card').evaluateAll(cards=>cards.map(c=>c.dataset.weapon));
  for(const id of cards){if(id!=='wooden-sword')await page.locator(`[data-buy-weapon="${id}"]`).click();const s=await info();assert.equal(s.model,id);assert.equal(s.weapon.id,id);assert.ok(s.weapon.damage>0&&s.weapon.range>0);}
  await page.locator('#panel-close').click();await page.screenshot({path:'game/artifacts/steve-netherite-axe-held.png'});
 });await context.close();
 await fresh();
 await check('Bow has a controlled cadence and a starting arrow cannot one-shot a regular zombie',async()=>{
  await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();
  await page.waitForFunction(()=>window.__survivalTest.run.state.phase==='playing');
  await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;r.obstacles=[];r._spawnClock=999;r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];p.invulnerable=999;p.cooldown=999;const e=r._spawnEnemy('walker',p.x,p.z-4,null);e.speed=0;p.cooldown=0;p.bowTime=8;window.__weaponTarget=e.id;});
  await page.waitForFunction(()=>{const t=window.__survivalTest,r=t.run,e=r.state.enemies.find(e=>e.id===window.__weaponTarget);return e&&e.hp<e.maxHp;});
  const s=await page.evaluate(()=>{const r=window.__survivalTest.run,e=r.state.enemies.find(e=>e.id===window.__weaponTarget);return{hp:e?.hp,maxHp:e?.maxHp,cooldown:r.state.player.cooldown,shots:r.state.stats.shots};});
  assert.ok(s.hp>0&&s.hp<s.maxHp);assert.ok(s.shots<=2);assert.ok(s.cooldown>.1);
  assert.equal(await page.evaluate(()=>window.__survivalTest.run.setWeapon('diamond-sword')),false,'equipment changes only before a run');
 });await context.close();
 for(const viewport of[{width:390,height:844},{width:844,height:390},{width:320,height:740}]){
  await fresh(viewport,{wallet:1500});
  await check(`${viewport.width}×${viewport.height}: shop fits, scrolls and keeps its close control`,async()=>{
   await page.locator('[data-panel="shop"]').click();assert.equal(await page.locator('.weapon-card').count(),17);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),viewport.width);
   const closeBefore=await page.locator('#panel-close').boundingBox();
   const scrolled=await page.locator('#panel-content').evaluate(e=>{e.scrollTop=e.scrollHeight;return{top:e.scrollTop,max:e.scrollHeight-e.clientHeight};});assert.ok(scrolled.max>0&&scrolled.top>0,'long weapon catalogue must really scroll');
   const box=await page.locator('#panel-close').boundingBox();assert.ok(box.y>0&&box.y+box.height<viewport.height);assert.equal(box.y,closeBefore.y,'close control must remain fixed while content scrolls');
   const pricesFit=await page.locator('.weapon-card .item-price').evaluateAll(es=>es.every(e=>{const b=e.closest('button'),p=e.getBoundingClientRect(),r=b.getBoundingClientRect();return p.left>=r.left-1&&p.right<=r.right+1&&b.scrollWidth<=b.clientWidth+1;}));assert.equal(pricesFit,true,'3/4-digit prices must fit their real purchase controls');
   await page.locator('#panel-content').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`game/artifacts/steve-shop-${viewport.width}.png`});
  });await context.close();
 }
 await check('No unhandled browser errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/steve-weapons-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
