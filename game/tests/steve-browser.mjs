import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir,copyFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const outdir=fileURLToPath(new URL('../artifacts/',import.meta.url));
await mkdir(outdir,{recursive:true});
const dir=(await mkdtemp(join(tmpdir(),'steve-qa-')))+'/';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};
const state=page=>page.evaluate(()=>window.__survivalTest.snapshot());
const phase=(page,value)=>page.waitForFunction(value=>document.querySelector('#hud').dataset.phase===value,value,{timeout:20000});
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
async function startOrResume(p,touch=false){await p.locator('#start')[touch?'tap':'click']();if(await p.locator('#lobby-panel[data-panel="play"]').isVisible())await p.locator('#launch-run')[touch?'tap':'click']();}
async function selectHero(p,hero){await p.locator('#change-hero').click();await p.locator('#lobby-panel[data-panel="inventory"]').waitFor({state:'visible'});const button=p.locator(`[data-select-hero="${hero}"]`);if(await button.isEnabled())await button.click();await p.locator('#panel-close').click();}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}}
async function fresh(viewport={width:1280,height:800},touch=false){
 const context=await browser.newContext({viewport,locale:'ru-RU',hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/survival.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 return{context,page};
}
async function fixture(p,distance=1.9){
 await p.evaluate(distance=>{
  const r=window.__survivalTest.run,s=r.state,p=s.player;
  r._spawnClock=999;s.enemies=[];s.projectiles=[];s.drops=[];p.invulnerable=999;p.cooldown=0;p.pendingAttack=null;
  const e=r._spawnEnemy('walker',p.x+distance,p.z);e.hp=e.maxHp=100000;e.speed=0;e.damage=0;
  window.__steveQAEvents=[];
  if(!r._qaEventOriginal){r._qaEventOriginal=r._event;r._event=function(type,data){window.__steveQAEvents.push({type,...data});return this._qaEventOriginal(type,data);};}
 },distance);
}
let main;
try{
 main=await fresh();const p=main.page;
 await check('Steve is available at first launch with two ready character choices',async()=>{
  assert.equal((await state(p)).character,'steve');
  assert.equal(await p.locator('#character-picker').isVisible(),false);await p.locator('#change-hero').click();assert.equal(await p.locator('[data-select-hero]').count(),2);await p.locator('#panel-close').click();
  await selectHero(p,'shelly');assert.equal((await state(p)).character,'shelly');assert.match(await p.locator('#lobby-hero-name').innerText(),/ШЕЛЛИ/i);
  await selectHero(p,'steve');assert.equal((await state(p)).character,'steve');assert.match(await p.locator('#lobby-hero-name').innerText(),/СТИВ/i);
  const img=await p.locator('#hero-portrait').evaluate(e=>({ok:e.complete&&e.naturalWidth>0,alt:e.alt}));assert.ok(img.ok,JSON.stringify(img));assert.match(img.alt,/Стив/i);
  assert.match(await p.locator('#hero-weapon').textContent(),/меч/i);assert.match(await p.locator('#super-label').textContent(),/лук/i);
  const model=await p.evaluate(()=>{const s=window.__survivalTest.steve,textures=[];s.root.traverse(o=>{if(o.material?.map)textures.push({width:o.material.map.image.width,height:o.material.map.image.height,filter:o.material.map.magFilter});});return{name:s.root.name,sword:s.sword.visible,bow:s.bow.visible,textures};});
  assert.equal(model.name,'Steve');assert.ok(model.sword&&!model.bow);assert.ok(model.textures.length>=6);assert.ok(model.textures.every(t=>t.width===64&&t.height===64&&t.filter===1003));observations.model=model;
  await p.screenshot({path:dir+'steve-qa-character-choice.png'});
 });
 await check('Steve selection persists reload and starts with melee statistics',async()=>{
  await p.reload();await p.waitForFunction(()=>document.body.dataset.ready==='true');assert.equal((await state(p)).character,'steve');
  await startOrResume(p);await phase(p,'playing');const s=await state(p);
  assert.equal(s.player.hp,125);assert.equal(s.player.weapon.type,'sword');assert.equal(s.player.bowTime,0);assert.equal(await p.locator('#character-picker').isVisible(),false);
 });
 await check('Sword animation events lead to real damage without pellet projectiles',async()=>{
  await fixture(p);
  await p.waitForFunction(()=>window.__steveQAEvents.some(e=>e.type==='melee')&&window.__steveQAEvents.some(e=>e.type==='meleeimpact')&&window.__survivalTest.run.state.stats.damageDealt>0);
  assert.ok(!(await state(p)).projectiles.some(x=>x.team==='player'));
  observations.meleeEvents=await p.evaluate(()=>window.__steveQAEvents.filter(e=>['melee','meleeimpact','hit'].includes(e.type)).slice(0,8));
  assert.ok(observations.meleeEvents.some(e=>e.type==='hit'&&e.cause==='sword'));
  await p.screenshot({path:dir+'steve-qa-sword-desktop.png'});
 });
 await check('Bow ability changes weapon, fires actual arrows, and shows its remaining time',async()=>{
  await fixture(p,6);await p.locator('#super').click();
  await p.waitForFunction(()=>window.__survivalTest.run.state.player.bowTime>6.5&&window.__steveQAEvents.some(e=>e.type==='bowshot'));
  assert.equal((await state(p)).stats.superUses,1);assert.match(await p.locator('#hero-weapon').textContent(),/лук/i);
  await p.waitForFunction(()=>window.__survivalTest.steve.bow.visible&&!window.__survivalTest.steve.sword.visible);
  assert.match(await p.locator('#super-state').innerText(),/с|сек/i);assert.equal(await p.locator('#super').isEnabled(),false);
  await p.waitForFunction(()=>window.__survivalTest.run.state.projectiles.some(x=>x.kind==='arrow'));
  observations.bow=await state(p);await p.screenshot({path:dir+'steve-qa-bow-desktop.png'});
 });
 await check('Bow time and model pose freeze on pause',async()=>{
  await p.keyboard.press('Escape');await phase(p,'paused');const a=await state(p);
  const pose=await p.evaluate(()=>{const s=window.__survivalTest.steve;if(!s?.root)return null;return s.root.toJSON();});
  await p.waitForTimeout(450);assert.equal((await state(p)).player.bowTime,a.player.bowTime);
  if(pose){const after=await p.evaluate(()=>window.__survivalTest.steve.root.toJSON());assert.deepEqual(after.object,pose.object);}
  await startOrResume(p);await phase(p,'playing');
 });
 await check('After eight active seconds Steve returns to sword attacks',async()=>{
  await p.waitForFunction(()=>window.__survivalTest.run.state.player.bowTime===0,null,{timeout:15000});
  await p.waitForFunction(()=>window.__survivalTest.steve.sword.visible&&!window.__survivalTest.steve.bow.visible);
  assert.match(await p.locator('#hero-weapon').textContent(),/меч/i);await fixture(p);
  await p.waitForFunction(()=>window.__steveQAEvents.some(e=>e.type==='meleeimpact'));
  assert.equal((await state(p)).player.weapon.type,'sword');
 });
 await check('Steve upgrades use sword/bow descriptions, can be selected, and keep pause behavior',async()=>{
  await p.evaluate(()=>{const r=window.__survivalTest.run;r.rng=()=>0;r.state.enemies=[];r.state.drops.push({id:900000,type:'xp',x:r.state.player.x,z:r.state.player.z,value:r.state.xpNeeded});});
  await phase(p,'upgrade');const before=await state(p);const text=await p.locator('#upgrade-choices').innerText();
  assert.match(text,/Острота/);assert.match(text,/меча и стрел/);assert.doesNotMatch(text,/дробин/);
  await p.waitForTimeout(250);assert.equal((await state(p)).elapsed,before.elapsed);
  await p.screenshot({path:dir+'steve-qa-upgrades-desktop.png'});await p.locator('[data-upgrade="damage"]').click();await phase(p,'playing');assert.ok((await state(p)).player.weapon.damage>42);
 });
 await check('New run resets bow and upgrades while retaining the chosen Steve',async()=>{
  await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.player.invulnerable=0;r._hurtPlayer(99999,0,0,'qa');});await phase(p,'dead');
  await startOrResume(p);await phase(p,'playing');const s=await state(p);assert.equal(s.character,'steve');assert.equal(s.player.hp,125);assert.equal(s.player.bowTime,0);assert.equal(s.player.pendingAttack,null);assert.ok(Object.values(s.upgrades).every(n=>n===0));
 });
 await main.context.close();main=null;
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const mobile=await fresh(viewport,true),p=mobile.page;
  await check(`${viewport.width}×${viewport.height}: character picker and start button fit`,async()=>{
   const boxes=Object.fromEntries(await Promise.all(['#change-hero','#start'].map(async s=>[s,await p.locator(s).boundingBox()])));
   for(const [selector,b]of Object.entries(boxes))assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,selector+JSON.stringify(b));
   await p.screenshot({path:dir+`steve-qa-menu-${viewport.width}.png`});await startOrResume(p,true);await phase(p,'playing');
  });
  await check(`${viewport.width}×${viewport.height}: bow countdown and controls remain readable and separate`,async()=>{
   await fixture(p,6);await p.locator('#super').tap();await p.waitForFunction(()=>window.__survivalTest.run.state.player.bowTime>6);
   const selectors=['#move-stick','#super','.hero-panel','.clock-panel','.right-panel'];const boxes=Object.fromEntries(await Promise.all(selectors.map(async s=>[s,await p.locator(s).boundingBox()])));
   observations[viewport.width+'layout']=boxes;
   for(const [name,b]of Object.entries(boxes))assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,name+JSON.stringify(b));
   assert.ok(!overlap(boxes['.hero-panel'],boxes['.right-panel']));assert.ok(!overlap(boxes['#move-stick'],boxes['#super']));
   await p.screenshot({path:dir+`steve-qa-bow-${viewport.width}.png`});
  });
  await check(`${viewport.width}×${viewport.height}: contextual upgrade cards fit and accept taps`,async()=>{
   await p.evaluate(()=>{const r=window.__survivalTest.run;r.rng=()=>0;r.state.enemies=[];r.state.drops.push({id:900000,type:'xp',x:r.state.player.x,z:r.state.player.z,value:r.state.xpNeeded});});await phase(p,'upgrade');
   for(const b of await p.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})))assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,JSON.stringify(b));
   await p.screenshot({path:dir+`steve-qa-upgrades-${viewport.width}.png`});await p.locator('.upgrade-choice').first().tap();await phase(p,'playing');
  });
  await mobile.context.close();
 }
 await check('No unhandled browser errors',()=>assert.deepEqual(errors,[]));
}finally{await main?.context.close();await browser.close();await writeFile(dir+'steve-qa-results.json',JSON.stringify({results,errors,observations},null,2));for(const name of await readdir(dir))await copyFile(join(dir,name),join(outdir,name));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
