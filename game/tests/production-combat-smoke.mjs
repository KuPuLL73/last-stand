import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {STEVE_WEAPONS,getSteveWeapon} from '../steve-weapons.js';
import {getSteveSkill} from '../steve-skills.js';
const base=process.env.PRODUCTION_GAME_ORIGIN||'http://127.0.0.1:4190';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};let context,page;
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.stack});console.log('FAIL',name,e.message);}};
const ready=()=>page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.querySelector('#start').disabled,null,{timeout:60000});
const phase=value=>page.waitForFunction(value=>document.querySelector('#hud').dataset.phase===value,value);
const hud=()=>page.locator('#hud').evaluate(e=>({elapsed:e.dataset.elapsed,x:e.dataset.x,z:e.dataset.z,shots:e.dataset.shots,skillTime:e.dataset.skillTime}));
try{
 for(const scenario of [
  {width:1280,height:800,weapon:'hunting-bow',skill:'dash',label:'РЫВОК'},
  {width:390,height:844,weapon:'crossbow',skill:'bulwark',label:'ЩИТ'},
 ]){
  const price=getSteveWeapon(scenario.weapon).price+getSteveSkill(scenario.skill).price,budget=price+123;
  await check(`${scenario.width}px production: real weapon/skill purchases and reload preserve the paid loadout`,async()=>{
   context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},hasTouch:scenario.width<900,isMobile:scenario.width<900,deviceScaleFactor:1,locale:'ru-RU'});
   await context.addInitScript(budget=>{if(sessionStorage.getItem('prod-combat-seeded'))return;localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','off');localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:budget}));sessionStorage.setItem('prod-combat-seeded','1');},budget);
   page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.setDefaultTimeout(15000);
   await page.goto(`${base}/survival.html`);await ready();assert.equal(await page.evaluate(()=>typeof window.__survivalTest),'undefined');
   await page.locator('[data-panel="shop"]').click();assert.equal(STEVE_WEAPONS.length,17);assert.equal(await page.locator('.weapon-card').count(),17);await page.locator(`[data-buy-weapon="${scenario.weapon}"]`).click();
   await page.locator('[data-shop-tab="skills"]').click();await page.locator(`[data-buy-skill="${scenario.skill}"]`).click();
   await page.reload();await ready();const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')));
   assert.equal(profile.wallet,budget-price);assert.equal(profile.weapon,scenario.weapon);assert.equal(profile.skill,scenario.skill);assert.ok(profile.ownedWeapons.includes(scenario.weapon));assert.ok(profile.ownedSkills.includes(scenario.skill));
   await page.locator('[data-panel="inventory"]').click();assert.equal(await page.locator(`[data-select-skill="${scenario.skill}"]`).isDisabled(),true);await page.screenshot({path:`game/artifacts/production-combat-loadout-${scenario.width}.png`});await page.locator('#panel-close').click();observations[scenario.width]={profile};
  });
  await check(`${scenario.width}px production: natural opening fires the selected weapon and the real skill control activates`,async()=>{
   await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await phase('playing');
   assert.equal(await page.locator('#hud').getAttribute('data-weapon'),scenario.weapon);assert.equal(await page.locator('#hud').getAttribute('data-skill'),scenario.skill);assert.equal(await page.locator('#super-label').innerText(),scenario.label);
   await page.waitForFunction(()=>Number(document.querySelector('#hud').dataset.shots)>0);await page.waitForFunction(()=>!document.querySelector('#super').disabled);
   await page.evaluate(()=>{window.__prodCombatHud=[];const h=document.querySelector('#hud');const observer=new MutationObserver(()=>window.__prodCombatHud.push({skillTime:Number(h.dataset.skillTime),x:Number(h.dataset.x),z:Number(h.dataset.z)}));observer.observe(h,{attributes:true});window.__prodCombatObserver=observer;});
   const button=await page.locator('#super').boundingBox();assert.ok(button);await page.mouse.move(button.x+button.width/2,button.y+button.height/2);const before=await hud();
   if(scenario.skill==='dash')await page.keyboard.down('d');
   await page.mouse.click(button.x+button.width/2,button.y+button.height/2);
   if(scenario.skill==='dash')await page.keyboard.up('d');
   await page.waitForFunction(()=>window.__prodCombatHud.some(e=>e.skillTime>0));
   if(scenario.skill==='dash'){await page.waitForFunction(()=>Number(document.querySelector('#hud').dataset.skillTime)===0);const after=await hud();assert.ok(Number(after.x)-Number(before.x)>1,'dash must move through the real arena');observations[scenario.width].dash={before,after};}
   else assert.ok(Number(await page.locator('#hud').getAttribute('data-skill-time'))>0);
   await page.evaluate(()=>window.__prodCombatObserver.disconnect());await page.screenshot({path:`game/artifacts/production-combat-playing-${scenario.width}.png`});observations[scenario.width].bundle=await page.locator('script[type="module"][src]').getAttribute('src');observations[scenario.width].hud=await hud();
  });
  await check(`${scenario.width}px production: pause freezes combat and active skill time, resume restarts the clock`,async()=>{
   await page.locator('#pause').click();await phase('paused');const before=await hud();await page.waitForTimeout(250);assert.deepEqual(await hud(),before);await page.locator('#start').click();await phase('playing');await page.waitForFunction(elapsed=>Number(document.querySelector('#hud').dataset.elapsed)>Number(elapsed),before.elapsed);assert.equal(await page.evaluate(()=>typeof window.__survivalTest),'undefined');
  });
  await context?.close();context=null;page=null;
 }
 await check('Production music switches the two MP3 channels through gestures, battle, pause, mute and retirement',async()=>{
  context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await context.addInitScript(()=>{localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','on');localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:0,musicVolume:.23}));});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});await page.goto(`${base}/survival.html`);await ready();
  assert.equal(await page.evaluate(()=>typeof window.__survivalTest),'undefined');assert.equal(await page.locator('audio').count(),2);
  const initial=await page.locator('audio').evaluateAll(es=>es.map(e=>({id:e.id,src:e.src,paused:e.paused})));assert.ok(initial.every(e=>e.paused));assert.notEqual(initial[0].src,initial[1].src);assert.ok(initial.every(e=>new URL(e.src).pathname.endsWith('.mp3')));
  const channel=which=>page.waitForFunction(which=>{const m=document.querySelector('#menu-music'),b=document.querySelector('#battle-music');if(which==='none')return m.paused&&b.paused&&m.volume===0&&b.volume===0;const a=which==='menu'?m:b,o=which==='menu'?b:m;return !a.paused&&o.paused&&Math.abs(a.volume-.23)<.005&&o.volume===0;},which);
  await page.locator('#start').click();await channel('menu');await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await phase('playing');await channel('battle');
  await page.locator('#pause').click();await phase('paused');await channel('none');await page.locator('#start').click();await phase('playing');await channel('battle');
  await page.locator('#sound').click();await channel('none');assert.equal(await page.evaluate(()=>localStorage.getItem('shelly-range-sound')),'off');await page.locator('#sound').click();await channel('battle');
  await page.locator('#pause').click();await phase('paused');await page.locator('#back-lobby').click();await phase('retired');await channel('none');await page.locator('#back-lobby').click();await phase('ready');await channel('menu');
  observations.music={initial,final:await page.locator('audio').evaluateAll(es=>es.map(e=>({id:e.id,paused:e.paused,volume:e.volume}))),debugHooks:await page.evaluate(()=>typeof window.__survivalTest)};
  await context.close();context=null;page=null;
 });
 await check('Production excludes the developer credit page, marker and grant code',async()=>{
  assert.equal(existsSync('dist/dev-credit.html'),false);
  for(const name of await readdir('dist/assets'))if(name.endsWith('.js')){const code=await readFile(`dist/assets/${name}`,'utf8');assert.ok(!code.includes('rift-test-credit.2026-11-04.100000'));assert.ok(!code.includes('grantTestCredit'));}
  const isolated=await browser.newContext(),response=await isolated.request.get(`${base}/dev-credit.html`),html=await response.text();assert.ok(response.status()===404||!html.includes('game/dev-credit.js'));observations.creditPageStatus=response.status();await isolated.close();
 });
 await check('Production has no uncaught JavaScript, shader or texture errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/production-combat-results.json',JSON.stringify({testedAt:new Date().toISOString(),results,errors,observations},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
