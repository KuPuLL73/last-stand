import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};
const state=p=>p.evaluate(()=>window.__survivalTest.snapshot());
const phase=(p,value)=>p.waitForFunction(value=>document.querySelector('#hud').dataset.phase===value,value);
async function startOrResume(p,touch=false){await p.locator('#start')[touch?'tap':'click']();if(await p.locator('#lobby-panel[data-panel="play"]').isVisible())await p.locator('#launch-run')[touch?'tap':'click']();}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}}
async function fresh(viewport={width:1280,height:800},touch=false){
 const context=await browser.newContext({viewport,locale:'ru-RU',hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('survival-character','shelly'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/survival.html');await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});return{context,page};
}
function overlap(a,b){return Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;}
async function bonuses(p){
 await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state,p=s.player;r._spawnClock=999;s.enemies=[];s.projectiles=[];s.drops=[];p.hp=50;p.invulnerable=0;for(const [i,type]of['heal','haste','rapid','shield','magnet'].entries())s.drops.push({id:99000+i,type,x:p.x,z:p.z,life:20,value:0,radius:.3});s.drops.push({id:99010,type:'xp',x:-9,z:-9,value:1,radius:.2});});
 await p.waitForFunction(()=>window.__survivalTest.run.state.stats.bonuses===5);
 await p.waitForFunction(()=>document.querySelectorAll('#buffs .buff-badge').length===3);
}
let main;
try{
 main=await fresh();const p=main.page;
 await check('Four-minute ready screen has no ammo stock or reload UI/state',async()=>{
  assert.equal(await p.locator('#clock').textContent(),'04:00');assert.equal(await p.locator('#ammo,#weapon-status,.weapon-panel').count(),0);
  const s=await state(p);assert.equal(s.remaining,240);for(const key of ['ammo','maxAmmo','reload'])assert.equal(key in s.player,false);assert.equal('reloadTime'in s.player.weapon,false);
  await startOrResume(p);await phase(p,'playing');
 });
 await check('Autofire passes three shots without any reload gap',async()=>{
  await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state;r._spawnClock=999;s.enemies=[];s.player.invulnerable=999;const e=r._spawnEnemy('walker',s.player.x+3,s.player.z);e.hp=e.maxHp=99999;e.speed=0;});
  const values=await p.evaluate(async()=>{const r=window.__survivalTest.run,initial=r.state.stats.shots,times=[];let seen=initial;const begun=performance.now();while(times.length<7&&performance.now()-begun<12000){await new Promise(requestAnimationFrame);if(r.state.stats.shots>seen){times.push(r.state.elapsed);seen=r.state.stats.shots;}}return times;});
  observations.shotTimes=values;assert.ok(values.length>=7,JSON.stringify(values));const gaps=values.slice(1).map((v,i)=>v-values[i]);assert.ok(gaps.every(d=>d>.58&&d<.83),JSON.stringify(gaps));
 });
 await check('All five zombie bonuses apply; timed buffs render and freeze on pause',async()=>{
  await bonuses(p);const s=await state(p);assert.equal(s.player.hp,75);assert.equal(s.xp,1);assert.ok(!s.drops.some(d=>d.type==='xp'));assert.ok(s.player.buffs.haste>8&&s.player.buffs.rapid>6&&s.player.buffs.shield>4);assert.equal(s.player.speed,4.6);assert.equal(s.player.weapon.fireInterval,.68);
  const labels=await p.locator('#buffs').innerText();assert.match(labels,/УСКОРЕНИЕ/);assert.match(labels,/БЫСТРЫЙ ОГОНЬ/);assert.match(labels,/ЩИТ/);
  await p.keyboard.press('Escape');await phase(p,'paused');const a=await state(p);await p.waitForTimeout(500);assert.deepEqual((await state(p)).player.buffs,a.player.buffs);await startOrResume(p);await phase(p,'playing');await p.waitForFunction(n=>window.__survivalTest.run.state.player.buffs.haste<n,a.player.buffs.haste);
 });
 await check('Native attack keeps feet fixed and restores without drift',async()=>{
  await p.keyboard.press('Escape');await phase(p,'paused');
  const info=await p.evaluate(()=>{
   const {model,mixer,shotFeedback:f}=window.__survivalTest;f.reset();mixer.update(0);model.updateWorldMatrix(true,true);
   const feet=[];model.traverse(o=>{if(o.isBone&&/ankle|toes/i.test(o.name))feet.push(o);});
   const bones=[f.chest,f.barrel,...feet].filter(Boolean),base=bones.map(o=>({name:o.name,local:o.position.toArray(),world:o.getWorldPosition(model.position.clone()).toArray()}));
   const muzzle=f.anchor.getWorldPosition(model.position.clone());const parent=model.parent;const m=parent.worldToLocal(muzzle.clone());
   f.trigger();f.update(.025);model.updateWorldMatrix(true,true);
   const kick=bones.map(o=>({name:o.name,local:o.position.toArray(),world:o.getWorldPosition(model.position.clone()).toArray()}));
   const firstFlash=f.flash.visible;f.afterRender();f.restorePose();f.update(.12);const secondFlash=f.flash.visible;f.afterRender();f.restorePose();f.update(.12);const endedFlash=f.flash.visible;f.restorePose();
   for(let i=0;i<100;i++){f.trigger();f.update(.025);f.restorePose();f.update(.2);f.restorePose();}model.updateWorldMatrix(true,true);
   const after=bones.map(o=>({name:o.name,local:o.position.toArray(),world:o.getWorldPosition(model.position.clone()).toArray()}));f.reset();return{base,kick,after,muzzle:m.toArray(),firstFlash,secondFlash,endedFlash,feet:feet.map(o=>o.name)};
  });
  observations.recoil=info;assert.ok(info.feet.length>=2,JSON.stringify(info.feet));assert.ok(info.muzzle[1]>.45&&info.muzzle[1]<1.4,JSON.stringify(info.muzzle));assert.ok(info.muzzle[2]>.3&&info.muzzle[2]<1.6,JSON.stringify(info.muzzle));
  for(let i=0;i<info.base.length;i++){const a=info.base[i],b=info.kick[i],c=info.after[i];const distance=Math.hypot(...a.world.map((v,j)=>v-b.world[j]));assert.ok(distance<.26,`${a.name} ${distance}`);if(/ankle|toes/i.test(a.name))assert.ok(distance<1e-6,`${a.name} feet moved ${distance}`);assert.deepEqual(c.local,a.local,`${a.name} local drift`);}
  assert.ok(info.firstFlash&&info.secondFlash&&!info.endedFlash,JSON.stringify(info));await startOrResume(p);await phase(p,'playing');
 });
 await p.screenshot({path:dir+'survival-v3-desktop.png'});await main.context.close();main=null;
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const mobile=await fresh(viewport,true),p=mobile.page;
  await check(`${viewport.width}×${viewport.height}: buffs/boss/build do not cover controls`,async()=>{
   await startOrResume(p,true);await phase(p,'playing');await bonuses(p);await p.evaluate(()=>{const r=window.__survivalTest.run;r._spawnBoss();r.state.player.invulnerable=999;for(const k of Object.keys(r.state.upgrades))r.state.upgrades[k]=1;});await p.waitForFunction(()=>document.querySelector('#boss-hud').hidden===false&&document.querySelectorAll('.build-chip').length===10);
   const dims=await p.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(dims.sw<=dims.w+1&&dims.sh<=dims.h+1,JSON.stringify(dims));
   const selectors=['#move-stick','#super','#buffs','#boss-hud','.build-panel'];const boxes=Object.fromEntries(await Promise.all(selectors.map(async s=>[s,await p.locator(s).boundingBox()])));observations[viewport.width+'layout']=boxes;
   for(const [name,b]of Object.entries(boxes))assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,name+JSON.stringify(b));
   for(const c of ['#move-stick','#super'])for(const overlay of ['#buffs','#boss-hud','.build-panel'])assert.ok(!overlap(boxes[c],boxes[overlay]),`${overlay} overlaps ${c}`);
   await p.screenshot({path:dir+`survival-v3-buffs-${viewport.width}.png`});
  });
  await check(`${viewport.width}×${viewport.height}: colored upgrade choices fit and remain touchable`,async()=>{
   await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.enemies=[];r.state.player.buffs={haste:0,rapid:0,shield:0};r.state.drops.push({id:999000,x:r.state.player.x,z:r.state.player.z,value:r.state.xpNeeded,type:'xp'});});await phase(p,'upgrade');
   assert.equal(await p.locator('.upgrade-choice .survival-icon').count(),3);for(const b of await p.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})))assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,JSON.stringify(b));await p.screenshot({path:dir+`survival-v3-upgrades-${viewport.width}.png`});await p.locator('.upgrade-choice').first().tap();await phase(p,'playing');
  });
  await mobile.context.close();
 }
 await check('No uncaught JavaScript browser errors',()=>assert.deepEqual(errors,[]));
}finally{await main?.context.close();await browser.close();await writeFile(dir+'survival-v3-results.json',JSON.stringify({results,errors,observations},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
