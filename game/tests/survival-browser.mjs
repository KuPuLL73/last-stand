import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];
const state=page=>page.evaluate(()=>window.__survivalTest.snapshot());
const hudPhase=(p,phase)=>p.waitForFunction(phase=>document.querySelector('#hud').dataset.phase===phase,phase,{timeout:20000});
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}}
async function fresh(options={}){
 const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ru-RU',...options});
 await context.addInitScript(()=>localStorage.setItem('survival-character','shelly'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/survival.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 return{context,page};
}
async function start(p){await p.locator('#start').click();await hudPhase(p,'playing');}
async function levelFixture(p){await p.evaluate(()=>{const r=window.__survivalTest.run;r.rng=()=>0;r.state.enemies=[];r.state.drops.push({id:999000,x:r.state.player.x,z:r.state.player.z,value:r.state.xpNeeded,type:'xp'});});await hudPhase(p,'upgrade');}
async function touchMove(p,dx,dy,until){const box=await p.locator('#move-stick').boundingBox(),x=box.x+box.width/2+dx,y=box.y+box.height/2+dy;const cdp=await p.context().newCDPSession(p);try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x,y,force:1,radiusX:4,radiusY:4}]});await p.waitForFunction(until,null,{timeout:15000});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}}
let main;
try{
 main=await fresh();const p=main.page;
 await check('Ready waits for gesture, then shots and damage happen automatically',async()=>{assert.equal((await state(p)).phase,'ready');await start(p);await p.waitForFunction(()=>window.__survivalTest.run.state.stats.shots>=3&&window.__survivalTest.run.state.stats.damageDealt>0,null,{timeout:20000});assert.ok((await state(p)).stats.damageDealt>0);});
 await check('Keyboard movement and manual Super operate during autofire',async()=>{const a=await state(p);await p.keyboard.down('d');try{await p.waitForFunction(x=>window.__survivalTest.run.state.player.x>x+1,a.player.x,{timeout:10000});}finally{await p.keyboard.up('d');}await p.keyboard.press('Space');await p.waitForFunction(()=>window.__survivalTest.run.state.stats.superUses===1);const b=await state(p);assert.ok(b.player.super<100);assert.equal(b.stats.superUses,1);});
 await check('Experience opens three unique choices and freezes active time / enemies',async()=>{await levelFixture(p);assert.equal(await p.locator('.upgrade-choice').count(),3);const ids=await p.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>e.dataset.upgrade));assert.equal(new Set(ids).size,3);const before=await state(p);await p.waitForTimeout(600);const after=await state(p);assert.equal(after.elapsed,before.elapsed);assert.deepEqual(after.enemies,before.enemies);assert.ok(await p.locator('#upgrade-overlay').isVisible());});
 await check('Selecting damage changes weapon and resumes the run',async()=>{const before=await state(p);await p.locator('[data-upgrade="damage"]').click();await hudPhase(p,'playing');const after=await state(p);assert.equal(after.upgrades.damage,1);assert.ok(after.player.weapon.damage>before.player.weapon.damage);assert.equal(await p.locator('#upgrade-overlay').isVisible(),false);});
 await check('Escape pause freezes, clears movement, and resume stays still',async()=>{await p.keyboard.down('a');await p.waitForTimeout(160);await p.keyboard.press('Escape');await hudPhase(p,'paused');const a=await state(p);await p.keyboard.up('a');await p.waitForTimeout(500);assert.equal((await state(p)).elapsed,a.elapsed);await p.locator('#start').click();await hudPhase(p,'playing');await p.waitForTimeout(400);const b=await state(p);assert.equal(b.player.x,a.player.x);assert.equal(b.player.z,a.player.z);});
 await check('External focus pause freezes gameplay without changing run phase',async()=>{await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(180);const a=await state(p);await p.waitForTimeout(450);assert.equal((await state(p)).elapsed,a.elapsed);assert.equal((await p.locator('#hud').getAttribute('data-active')),'false');await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(time=>window.__survivalTest.run.state.elapsed>time,a.elapsed);});
 await p.screenshot({path:dir+'survival-desktop.png'});
 await check('Death shows result and a new run resets all progression',async()=>{await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.player.invulnerable=0;r._hurtPlayer(9999,r.state.player.x,r.state.player.z,'qa');});await hudPhase(p,'dead');assert.ok(await p.locator('#result-stats').isVisible());await p.locator('#start').click();await hudPhase(p,'playing');const s=await state(p);assert.equal(s.level,1);assert.equal(s.player.hp,100);assert.equal(s.kills,0);assert.ok(Object.values(s.upgrades).every(n=>n===0));});
 await check('Final boss appears with health bar and actual boss kill shows victory',async()=>{await p.evaluate(()=>{const r=window.__survivalTest.run;r.duration=1;r.state.elapsed=.99;r.state.enemies=[];r.state.player.invulnerable=99;});await p.waitForFunction(()=>window.__survivalTest.run.state.bossId!==null);assert.ok(await p.locator('#boss-hud').isVisible());await p.evaluate(()=>{const r=window.__survivalTest.run;r._damageEnemy(r.state.enemies.find(e=>e.id===r.state.bossId),99999,'qa');});await hudPhase(p,'won');assert.ok((await p.locator('#menu-eyebrow').innerText()).includes('ПОБЕДА'));await p.screenshot({path:dir+'survival-victory.png'});});
 await main.context.close();main=null;
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const mobile=await fresh({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1}),p=mobile.page;
  await check(`${viewport.width}×${viewport.height}: start and controls stay in viewport`,async()=>{for(const selector of ['#start']){const b=await p.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,selector+JSON.stringify(b));}await start(p);for(const selector of ['#move-stick','#super']){const b=await p.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,selector+JSON.stringify(b));}});
  await check(`${viewport.width}×${viewport.height}: one stick moves, releases and Super button works`,async()=>{const a=await state(p);await touchMove(p,25,0,()=>window.__survivalTest.run.state.player.x>1);await p.waitForTimeout(180);const b=await state(p);assert.ok(b.player.x>a.player.x+.5);await p.waitForTimeout(300);assert.equal((await state(p)).player.x,b.player.x);await p.locator('#super').tap();await p.waitForFunction(()=>window.__survivalTest.run.state.stats.superUses===1);});
  await check(`${viewport.width}×${viewport.height}: upgrade cards fit, touch choice resumes`,async()=>{await levelFixture(p);await p.screenshot({path:dir+`survival-upgrade-${viewport.width}.png`});for(const box of await p.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}))){assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify(box));}await p.locator('.upgrade-choice').first().tap();await hudPhase(p,'playing');const dims=await p.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(dims.sw<=dims.w+1&&dims.sh<=dims.h+1,JSON.stringify(dims));});
  await p.screenshot({path:dir+`survival-mobile-${viewport.width}.png`});await mobile.context.close();
 }
 await check('No uncaught browser errors',()=>assert.deepEqual(errors,[]));
}finally{await main?.context.close();await browser.close();await writeFile(dir+'survival-browser-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
