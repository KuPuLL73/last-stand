import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {STEVE_WEAPONS,getSteveWeapon} from '../steve-weapons.js';
import {getSteveSkill} from '../steve-skills.js';
const rangedIds=STEVE_WEAPONS.filter(w=>w.attackMode==='ranged').map(w=>w.id),skillCost=getSteveSkill('dash').price+getSteveSkill('bulwark').price;
const rangedCost=rangedIds.reduce((total,id)=>total+getSteveWeapon(id).price,0),testBudget=rangedCost+skillCost+250;
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack});console.log('FAIL',name,error.message);}};
let context;
try{
 await check('Ranged models render their original bow/crossbow/blaze-rod pixels',async()=>{
  const p=await browser.newPage({viewport:{width:1200,height:720}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5190/game/artifacts/ranged-preview.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
  const data=await p.evaluate(()=>window.__rangedPreview.models.map(m=>({id:m.weaponId,held:m.root.userData.heldWeapon,ranged:m.root.userData.rangedActive})));
  assert.deepEqual(data.map(d=>d.id),['hunting-bow','crossbow','ember-staff']);assert.ok(data.every(d=>d.ranged&&d.id===d.held));
  await p.screenshot({path:'game/artifacts/ranged-models-final.png'});await p.close();
 });
 await check('New player owns only bow and cannot buy or select an unaffordable skill',async()=>{
  context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5190/survival.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
  const before=await p.evaluate(()=>structuredClone(window.__survivalTest.lobby.profile));assert.equal(before.wallet,0);assert.deepEqual(before.ownedSkills,['bow']);assert.equal(before.skill,'bow');
  await p.locator('[data-panel="shop"]').click();await p.locator('[data-shop-tab="skills"]').click();
  assert.equal(await p.locator('[data-buy-skill="dash"]').isDisabled(),true);assert.equal(await p.locator('[data-buy-skill="bulwark"]').isDisabled(),true);
  assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.selectSkill('dash')),false);assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.buySkill('dash')),false);
  assert.deepEqual(await p.evaluate(()=>structuredClone(window.__survivalTest.lobby.profile)),before);
  await p.locator('[data-shop-tab="skills"]').press('ArrowLeft');assert.equal(await p.locator('[data-shop-tab="auras"]').getAttribute('aria-selected'),'true');
  await p.locator('[data-shop-tab="auras"]').press('Home');assert.equal(await p.locator('[data-shop-tab="weapons"]').getAttribute('aria-selected'),'true');
  await p.locator('[data-shop-tab="weapons"]').press('End');assert.equal(await p.locator('[data-shop-tab="skills"]').getAttribute('aria-selected'),'true');
  await p.screenshot({path:'game/artifacts/ranged-skill-shop-locked-390.png'});
  await context.close();context=null;
 });
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390},{width:320,height:740}]){
  await check(`${viewport.width}px legacy loadout: ranged and permanent skill purchases persist`,async()=>{
   context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<900,isMobile:viewport.width<900});
   await context.addInitScript(budget=>{if(sessionStorage.getItem('ranged-seeded'))return;localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','off');localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:budget,owned:['teal','amber'],equipped:'amber',ownedWeapons:['wooden-sword','stone-sword'],weapon:'stone-sword',skill:'bulwark',claims:['first'],runs:[]}));sessionStorage.setItem('ranged-seeded','1');},testBudget);
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5190/survival.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
   assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.skill),'bow');assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),testBudget);assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.equipped),'amber');
   assert.deepEqual(await p.evaluate(()=>window.__survivalTest.lobby.profile.ownedSkills),['bow']);
   assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.selectSkill('bulwark')),false);
   await p.locator('[data-panel="shop"]').click();assert.equal(STEVE_WEAPONS.length,17);assert.equal(rangedIds.length,5);assert.equal(await p.locator('.weapon-card').count(),17);assert.equal(await p.locator('.weapon-card .weapon-kind').count(),5);
   const tabsFit=await p.locator('[data-shop-tab]').evaluateAll(es=>{const box=document.querySelector('#panel-content').getBoundingClientRect();return es.every(e=>{const r=e.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;});});assert.equal(tabsFit,true);
   let remaining=testBudget;for(const id of rangedIds){const card=p.locator(`[data-weapon="${id}"]`);await card.scrollIntoViewIfNeeded();assert.ok(await card.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));assert.ok((await card.locator('button').innerText()).replace(/\D/g,'').includes(String(getSteveWeapon(id).price)));const priceFits=await card.locator('button').evaluate(e=>{const price=e.querySelector('.item-price'),r=e.getBoundingClientRect(),p=price.getBoundingClientRect();return p.left>=r.left-1&&p.right<=r.right+1&&e.scrollWidth<=e.clientWidth+1;});assert.equal(priceFits,true);await card.locator('button').click();remaining-=getSteveWeapon(id).price;assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.weapon),id);assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),remaining);}
   assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),testBudget-rangedCost);await p.locator('#panel-close').click();await p.locator('[data-panel="inventory"]').click();
   assert.equal(await p.locator('.skill-card').count(),3);
   assert.equal(await p.locator('[data-select-skill="dash"]').count(),0);
   await p.locator('[data-skill="dash"] [data-skill-shop]').click();assert.equal(await p.locator('#lobby-panel').getAttribute('data-panel'),'shop');assert.equal(await p.locator('[data-shop-tab="skills"]').getAttribute('aria-selected'),'true');
   assert.ok(getSteveSkill('dash').price>=1000&&getSteveSkill('bulwark').price>getSteveSkill('dash').price);assert.ok((await p.locator('[data-buy-skill="dash"]').innerText()).replace(/\D/g,'').includes(String(getSteveSkill('dash').price)));
   const skillPricesFit=await p.locator('.skill-card .item-price').evaluateAll(es=>es.every(e=>{const b=e.closest('button'),p=e.getBoundingClientRect(),r=b.getBoundingClientRect();return p.left>=r.left-1&&p.right<=r.right+1&&b.scrollWidth<=b.clientWidth+1;}));assert.equal(skillPricesFit,true,'4-digit skill prices must fit their real purchase controls');
   await p.locator('[data-buy-skill="dash"]').click();assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.skill),'dash');assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),testBudget-rangedCost-getSteveSkill('dash').price);
   await p.locator('[data-buy-skill="bulwark"]').click();assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.skill),'bulwark');assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),testBudget-rangedCost-skillCost);
   await p.locator('[data-buy-skill="bow"]').click();await p.locator('[data-buy-skill="bulwark"]').click();assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),250);
   await p.screenshot({path:`game/artifacts/ranged-skill-shop-${viewport.width}.png`});await p.locator('#panel-close').click();await p.locator('[data-panel="inventory"]').click();
   const layout=await p.locator('.skill-card').evaluateAll(es=>es.map(e=>({w:e.clientWidth,s:e.scrollWidth})));
   assert.ok(layout.every(e=>e.s<=e.w+1));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),viewport.width);
   await p.locator('.skill-grid').scrollIntoViewIfNeeded();await p.screenshot({path:`game/artifacts/ranged-skills-${viewport.width}.png`});
   await p.reload();await p.waitForFunction(()=>document.body.dataset.ready==='true');
   const saved=await p.evaluate(()=>window.__survivalTest.lobby.profile);assert.equal(saved.skill,'bulwark');assert.equal(saved.weapon,rangedIds.at(-1));assert.equal(saved.wallet,testBudget-rangedCost-skillCost);assert.deepEqual(saved.ownedSkills,['bow','dash','bulwark']);assert.equal(saved.equipped,'amber');assert.ok(saved.ownedWeapons.includes('stone-sword'));assert.ok(rangedIds.every(id=>saved.ownedWeapons.includes(id)));
   await context.close();context=null;
  });
 }
 await check('External profile credit updates the open wallet without resetting battle or losing funds on purchase',async()=>{
  context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.addInitScript(()=>{if(sessionStorage.getItem('storage-seeded'))return;localStorage.setItem('survival-character','steve');localStorage.setItem('shelly-range-sound','off');if(!localStorage.getItem('rift-survival-profile.v1'))localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:50}));sessionStorage.setItem('storage-seeded','1');});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5190/survival.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
  await p.locator('#start').click();await p.locator('#launch-run').click();await p.waitForFunction(()=>window.__survivalTest.run.state.phase==='playing');await p.locator('#pause').click();
  await p.evaluate(()=>window.__storageRun=window.__survivalTest.run.state);
  await context.route('**/storage-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage test</title>'}));
  const donor=await context.newPage();await donor.goto('http://127.0.0.1:5190/storage-fixture.html');
  await donor.evaluate(()=>{const key='rift-survival-profile.v1',profile=JSON.parse(localStorage.getItem(key));profile.wallet+=100000;localStorage.setItem(key,JSON.stringify(profile));});
  await p.waitForFunction(()=>window.__survivalTest.lobby.profile.wallet===100050);
  assert.equal(await p.evaluate(()=>window.__storageRun===window.__survivalTest.run.state),true);assert.equal(await p.evaluate(()=>window.__survivalTest.run.state.phase),'paused');
  await donor.close();await p.bringToFront();await p.locator('#back-lobby').click();await p.waitForFunction(()=>window.__survivalTest.run.state.phase==='retired');await p.locator('#back-lobby').click();await p.waitForFunction(()=>window.__survivalTest.run.state.phase==='ready');
  const before=await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet);await p.locator('[data-panel="shop"]').click();await p.locator('[data-buy-weapon="stone-sword"]').click();assert.equal(await p.evaluate(()=>window.__survivalTest.lobby.profile.wallet),before-getSteveWeapon('stone-sword').price);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')).wallet),before-getSteveWeapon('stone-sword').price);
  await context.close();context=null;
 });
 await check('No uncaught JavaScript errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/ranged-loadout-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));
if(results.some(r=>!r.ok))process.exitCode=1;
