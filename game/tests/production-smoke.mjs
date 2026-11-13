import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {STEVE_WEAPONS,getSteveWeapon} from '../steve-weapons.js';
const purchaseBuffer=140,purchaseBudget=getSteveWeapon('stone-sword').price+purchaseBuffer;
const url=process.env.PRODUCTION_GAME_URL||'http://127.0.0.1:4190/survival.html';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[],errors=[],observations={};
let context,page;
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}};
const stablePanel=()=>page.locator('#lobby-panel').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
async function fresh(viewport,seed=false){
 context=await browser.newContext({viewport,deviceScaleFactor:1,locale:'ru-RU',isMobile:viewport.width<800,hasTouch:viewport.width<800});
 await context.addInitScript(({seed,budget})=>{localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');if(seed&&!localStorage.getItem('rift-survival-profile.v1'))localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:budget,owned:['teal'],equipped:'teal',runs:[],claims:[],effects:true}));},{seed,budget:purchaseBudget});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 assert.equal(await page.evaluate(()=>typeof window.__survivalTest),'undefined','production must not expose development hooks');
 const bundle=await page.locator('script[type="module"][src]').getAttribute('src');observations.bundle=bundle;
 if(process.env.PRODUCTION_EXPECTED_BUNDLE)assert.ok(bundle.endsWith(process.env.PRODUCTION_EXPECTED_BUNDLE),bundle);
}
try{
 await fresh({width:1280,height:800});
 await check('Production fresh profile starts with a wooden sword and no debug hooks',async()=>{
  assert.equal((await page.locator('#wallet-value').innerText()).trim(),'0');await page.locator('[data-panel="inventory"]').click();assert.match(await page.locator('.inventory-items').innerText(),/Деревянный меч/);await stablePanel();await page.screenshot({path:'game/artifacts/production-fresh-inventory.png'});
 });await context.close();context=null;
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  await fresh(viewport,true);const size=viewport.width;
  await check(`${size}px production shop: seventeen loaded models and one real stone-sword purchase`,async()=>{
   await page.locator('[data-panel="shop"]').click();assert.equal(STEVE_WEAPONS.length,17);assert.equal(await page.locator('.weapon-card').count(),17);
   await page.waitForFunction(()=>[...document.querySelectorAll('.weapon-card img')].every(i=>i.complete&&i.naturalWidth>0));
   assert.ok(await page.locator('[data-buy-weapon="stone-sword"]').isEnabled());await stablePanel();await page.screenshot({path:`game/artifacts/production-shop-${size}.png`});
   await page.locator('[data-buy-weapon="stone-sword"]').click();assert.equal(Number((await page.locator('#wallet-value').innerText()).replace(/\D/g,'')),purchaseBudget-getSteveWeapon('stone-sword').price);
   const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')));assert.equal(profile.wallet,purchaseBudget-getSteveWeapon('stone-sword').price);assert.equal(profile.weapon,'stone-sword');assert.ok(profile.ownedWeapons.includes('stone-sword'));
   assert.equal(await page.locator('[data-buy-weapon="stone-sword"]').isDisabled(),true);
  });
  await check(`${size}px production reload preserves purchased currency, inventory and held weapon`,async()=>{
   await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');assert.equal(Number((await page.locator('#wallet-value').innerText()).replace(/\D/g,'')),purchaseBuffer);
   const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')));assert.equal(profile.weapon,'stone-sword');assert.equal(profile.wallet,purchaseBuffer);
   await page.locator('[data-panel="inventory"]').click();assert.match(await page.locator('.inventory-items').innerText(),/Каменный меч/);await stablePanel();await page.screenshot({path:`game/artifacts/production-stone-inventory-${size}.png`});await page.locator('#panel-close').click();await page.screenshot({path:`game/artifacts/production-stone-held-${size}.png`});
  });
  await check(`${size}px production endless: selected weapon, actual movement and pause/resume`,async()=>{
   await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();
   await page.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='playing');assert.equal(await page.locator('#hud').getAttribute('data-mode'),'endless');assert.match(await page.locator('#hero-weapon').innerText(),/КАМЕННЫЙ МЕЧ/i);
   const before=Number(await page.locator('#hud').getAttribute('data-x')),elapsedBefore=Number(await page.locator('#hud').getAttribute('data-elapsed'));
   await page.keyboard.down('d');
   try{await page.waitForFunction(x=>Number(document.querySelector('#hud').dataset.x)>x+.6,before,{timeout:8000});}
   finally{await page.keyboard.up('d');}
   const after=Number(await page.locator('#hud').getAttribute('data-x')),elapsedAfter=Number(await page.locator('#hud').getAttribute('data-elapsed'));assert.ok(after-before>.5,`${before} → ${after}`);assert.ok(elapsedAfter>elapsedBefore,'movement must advance actual active simulation time');
   await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='paused');const frozen=await page.locator('#hud').getAttribute('data-elapsed');await page.waitForTimeout(350);assert.equal(await page.locator('#hud').getAttribute('data-elapsed'),frozen);
   await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='playing');await page.waitForFunction(elapsed=>Number(document.querySelector('#hud').dataset.elapsed)>Number(elapsed)+.1,frozen);await page.screenshot({path:`game/artifacts/production-endless-${size}.png`});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),viewport.width);observations[size]={movement:{before,after,elapsedBefore,elapsedAfter},frozenAt:frozen,weapon:await page.locator('#hero-weapon').innerText(),debugHooks:await page.evaluate(()=>typeof window.__survivalTest)};
  });await context.close();context=null;
 }
 await check('Production desktop/mobile have no uncaught JavaScript, texture or shader errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/production-smoke-results.json',JSON.stringify({url,results,errors,observations},null,2));}
const summary={passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors};console.log(JSON.stringify(summary));if(summary.failed)process.exitCode=1;
