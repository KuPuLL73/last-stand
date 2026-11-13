import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir,copyFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const outdir=fileURLToPath(new URL('../artifacts/',import.meta.url));
await mkdir(outdir,{recursive:true});
const dir=(await mkdtemp(join(tmpdir(),'pudge-qa-')))+'/';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};
const state=p=>p.evaluate(()=>window.__survivalTest.snapshot());
const phase=(p,value)=>p.waitForFunction(value=>document.querySelector('#hud').dataset.phase===value,value,{timeout:20000});
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
async function fresh(viewport={width:1400,height:900},touch=false){
 const context=await browser.newContext({viewport,locale:'ru-RU',hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
 await context.addInitScript(()=>{localStorage.setItem('survival-character','pudge');localStorage.setItem('survival-map','cubic');});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5190/survival.html');await p.waitForFunction(()=>document.body.dataset.ready==='true'&&document.body.dataset.pudgeReady==='true',null,{timeout:120000});return{context,p};
}
async function isolate(p,distance=1.7){
 await p.evaluate(distance=>{const r=window.__survivalTest.run,s=r.state,p=s.player;r._spawnClock=999;s.enemies=[];s.projectiles=[];s.drops=[];p.invulnerable=999;p.pendingAttack=null;p.cooldown=0;
  if(distance!==null){const e=r._spawnEnemy('walker',p.x+distance,p.z);e.hp=e.maxHp=99999;e.speed=0;e.damage=0;}
  window.__pudgeQAEvents=[];if(!r._qaEventOriginal){r._qaEventOriginal=r._event;r._event=function(type,data){window.__pudgeQAEvents.push({type,...data});return this._qaEventOriginal(type,data);};}
 },distance);
}
async function offerRot(p){
 await isolate(p,null);await p.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;r.state.drops.push({id:800000,type:'xp',x:p.x,z:p.z,value:r.state.xpNeeded});});await phase(p,'upgrade');
}
async function bounds(p,selectors,viewport){const boxes=Object.fromEntries(await Promise.all(selectors.map(async selector=>[selector,await p.locator(selector).boundingBox()])));for(const[name,b]of Object.entries(boxes))assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,name+JSON.stringify(b));return boxes;}
let main;
try{
 main=await fresh();const p=main.p;
 await check('Pudge loads as a selectable third hero with a real model and portrait',async()=>{
  assert.equal(await p.locator('.character-options button').count(),3);assert.equal(await p.locator('.character-options [data-character="pudge"]').isEnabled(),true);assert.equal((await state(p)).character,'pudge');
  assert.match(await p.locator('#hero-name').innerText(),/ПУДЖ/);assert.match(await p.locator('#super-label').innerText(),/КРЮК/);assert.match(await p.locator('#hero-weapon').innerText(),/ТЕСАК/);
  const info=await p.evaluate(()=>{const hero=window.__survivalTest.pudge;let meshes=0,vertices=0;hero.root.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});const img=document.querySelector('#hero-portrait');return{name:hero.root.name,visible:hero.root.visible,meshes,vertices,portrait:img.complete&&img.naturalWidth>0};});
  observations.model=info;assert.equal(info.name,'Pudge');assert.ok(info.meshes>0&&info.vertices>1000&&info.portrait&&info.visible,JSON.stringify(info));await p.screenshot({path:dir+'pudge-qa-menu-desktop.png'});
 });
 await check('Switching heroes and reload preserve the chosen Pudge',async()=>{
  await p.locator('.character-options [data-character="steve"]').click();assert.equal((await state(p)).character,'steve');await p.locator('.character-options [data-character="pudge"]').click();assert.equal((await state(p)).character,'pudge');
  await p.reload();await p.waitForFunction(()=>document.body.dataset.ready==='true'&&document.body.dataset.pudgeReady==='true');assert.equal((await state(p)).character,'pudge');
  await p.locator('#start').click();await phase(p,'playing');const s=await state(p);assert.equal(s.player.hp,160);assert.equal(s.player.weapon.type,'cleaver');assert.equal(s.player.rot.level,0);assert.equal(await p.locator('[data-passive="rot"]').getAttribute('class').then(c=>c.includes('locked')),true);
 });
 await check('Cleaver attacks animate and inflict real damage without bullets',async()=>{
  await isolate(p);await p.waitForFunction(()=>window.__pudgeQAEvents.some(e=>e.type==='meleeimpact')&&window.__pudgeQAEvents.some(e=>e.type==='hit'&&e.cause==='cleaver'));
  const info=await p.evaluate(()=>({events:window.__pudgeQAEvents.filter(e=>['melee','meleeimpact','hit'].includes(e.type)).slice(0,7),attackAge:window.__survivalTest.pudge.root.userData.attackAge}));observations.melee=info;assert.ok(info.events.some(e=>e.type==='melee'&&e.character==='pudge'));assert.ok(!(await state(p)).projectiles.some(e=>e.team==='player'));await p.screenshot({path:dir+'pudge-qa-cleaver.png'});
 });
 await check('Rot drops as an upgrade card and selecting it unlocks visible aura and badge',async()=>{
  await offerRot(p);assert.equal(await p.locator('[data-upgrade="rot"]').count(),1);assert.match(await p.locator('[data-upgrade="rot"]').innerText(),/12 урона/);await p.screenshot({path:dir+'pudge-qa-rot-card-desktop.png'});
  await p.locator('[data-upgrade="rot"]').click();await phase(p,'playing');await p.waitForFunction(()=>window.__survivalTest.pudgeEffects.fog.visible&&document.querySelector('#hud').dataset.rot==='1');
  const s=await state(p);assert.equal(s.player.rot.level,1);assert.equal(s.player.rot.dps,12);assert.equal(s.player.rot.radius,2.3);assert.equal(await p.locator('[data-passive="rot"]').getAttribute('class').then(c=>c.includes('locked')),false);await p.screenshot({path:dir+'pudge-qa-rot-aura-desktop.png'});
 });
 await check('Rot damages and slows nearby enemies without self-damage',async()=>{
  await isolate(p,1.9);await p.evaluate(()=>{const s=window.__survivalTest.run.state,p=s.player;p.cooldown=999;p.pendingAttack=null;s.enemies[0].x=p.x+1.25;s.enemies[0].z=p.z;});const before=await state(p);
  await p.waitForFunction(damage=>window.__survivalTest.run.state.stats.damageDealt>damage,before.stats.damageDealt);const after=await state(p);assert.ok(after.stats.damageDealt>before.stats.damageDealt);assert.equal(after.player.hp,before.player.hp);assert.equal(after.enemies[0].rotSlow,.2);observations.rot=after.player.rot;
 });
 await check('Pause freezes gameplay, Pudge pose and Rot particle motion',async()=>{
  await p.keyboard.press('Escape');await phase(p,'paused');
  const snapshot=()=>p.evaluate(()=>{const t=window.__survivalTest;return{elapsed:t.run.state.elapsed,player:structuredClone(t.run.state.player),effectTime:t.pudgeEffects.time,fog:Array.from(t.pudgeEffects.fog.geometry.attributes.position.array),attackAge:t.pudge.root.userData.attackAge,hookAge:t.pudge.root.userData.hookAge};});
  const a=await snapshot();await p.waitForTimeout(500);assert.deepEqual(await snapshot(),a);await p.locator('#start').click();await phase(p,'playing');
 });
 await check('Hook spends its charge, pulls its target and creates a chain effect',async()=>{
  await isolate(p,5.5);await p.evaluate(()=>{const t=window.__survivalTest;t.run.state.player.super=100;t.run.state.player.superCooldown=0;window.__pudgeHookCalls=[];window.__pudgeHookPeak=0;const hook=t.pudgeEffects.hook.bind(t.pudgeEffects),update=t.pudgeEffects.update.bind(t.pudgeEffects);t.pudgeEffects.hook=e=>{window.__pudgeHookCalls.push({...e});hook(e);};t.pudgeEffects.update=(...args)=>{update(...args);window.__pudgeHookPeak=Math.max(window.__pudgeHookPeak,t.pudgeEffects.chain.count);if(t.pudgeEffects.hookState?.age>.07&&t.pudgeEffects.chain.count>8){t.run.update=()=>{};t.pudge.update=()=>{};t.effects.update=()=>{};t.pudgeEffects.update=()=>{};}};});await p.waitForFunction(()=>!document.querySelector('#super').disabled);await p.locator('#super').click();
  await p.waitForFunction(()=>window.__pudgeHookCalls.length===1);const s=await state(p);assert.equal(s.stats.superUses,1);assert.ok(s.player.super<100);const e=s.enemies[0];assert.ok(Math.hypot(e.x-s.player.x,e.z-s.player.z)<2.1,JSON.stringify(e));const call=await p.evaluate(()=>window.__pudgeHookCalls[0]);assert.ok(Math.hypot(call.targetX-call.x,call.targetZ-call.z)>5);observations.hook=call;
  await p.waitForFunction(()=>window.__pudgeHookPeak>0,null,{timeout:3000});await p.screenshot({path:dir+'pudge-qa-hook.png'});
 });
 await check('Restart retains Pudge but clears learned Rot and its cloud',async()=>{
  await p.keyboard.press('Escape');await phase(p,'paused');await p.locator('#restart').click();await phase(p,'playing');const s=await state(p);assert.equal(s.character,'pudge');assert.equal(s.player.hp,160);assert.equal(s.player.rot.level,0);assert.equal(s.upgrades.rot,0);assert.equal(await p.evaluate(()=>window.__survivalTest.pudgeEffects.fog.visible),false);
 });
 await main.context.close();main=null;
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const mobile=await fresh(viewport,true),p=mobile.p;
  await check(`${viewport.width}×${viewport.height}: third-hero menu and start fit`,async()=>{observations['menu'+viewport.width]=await bounds(p,['#character-picker','#map-picker','#start'],viewport);assert.equal(await p.evaluate(()=>innerWidth),viewport.width);await p.screenshot({path:dir+`pudge-qa-menu-${viewport.width}.png`});await p.locator('#start').tap();await phase(p,'playing');});
  await check(`${viewport.width}×${viewport.height}: Rot choices fit and accept a tap`,async()=>{await offerRot(p);await bounds(p,['#upgrade-choices'],viewport);for(const b of await p.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})))assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,JSON.stringify(b));await p.screenshot({path:dir+`pudge-qa-rot-card-${viewport.width}.png`});await p.locator('[data-upgrade="rot"]').tap();await phase(p,'playing');await p.waitForFunction(()=>window.__survivalTest.pudgeEffects.fog.visible);});
  await check(`${viewport.width}×${viewport.height}: active Rot and controls remain separate`,async()=>{const boxes=await bounds(p,['#move-stick','#super','#buffs','.hero-panel','.right-panel'],viewport);assert.ok(!overlap(boxes['#move-stick'],boxes['#super']));assert.ok(!overlap(boxes['#buffs'],boxes['#super']));assert.ok(!overlap(boxes['.hero-panel'],boxes['.right-panel']));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),viewport.width);await p.screenshot({path:dir+`pudge-qa-rot-aura-${viewport.width}.png`});});
  await mobile.context.close();
 }
 await check('No unhandled browser JavaScript errors',()=>assert.deepEqual(errors,[]));
}finally{await main?.context.close();await browser.close();await writeFile(dir+'pudge-qa-results.json',JSON.stringify({results,errors,observations},null,2));for(const name of await readdir(dir))await copyFile(join(dir,name),join(outdir,name));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors},null,2));if(results.some(r=>!r.ok))process.exitCode=1;
