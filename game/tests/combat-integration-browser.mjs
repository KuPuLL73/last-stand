import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {STEVE_WEAPONS,getSteveWeapon} from '../steve-weapons.js';
import {getSteveSkill} from '../steve-skills.js';
import {upgradePresentation} from '../upgrade-presentation.js';
const skillCost=getSteveSkill('dash').price+getSteveSkill('bulwark').price;
const loadoutBudget=Math.max(...STEVE_WEAPONS.map(w=>w.price))+skillCost+1000;

// Each scenario has its own browser storage. Real shop, loadout and gameplay
// controls run normally; stationary durable targets isolate projectile/skill
// behavior without claiming that the arranged encounter occurred naturally.
const base=process.env.COMBAT_GAME_ORIGIN||'http://127.0.0.1:5190';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};let context,page;
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack});console.log('FAIL',name,error.message);}};
const phase=name=>page.waitForFunction(name=>window.__survivalTest.run.state.phase===name,name);
async function ready(p=page){
 await p.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__survivalTest?.lobby,null,{timeout:60000});
 await p.waitForFunction(()=>!document.querySelector('#start').disabled);
}
async function fresh(viewport,profile={wallet:loadoutBudget}){
 context=await browser.newContext({viewport,deviceScaleFactor:1,locale:'ru-RU',hasTouch:viewport.width<900,isMobile:viewport.width<900});
 await context.addInitScript(profile=>{if(sessionStorage.getItem('combat-seeded'))return;localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','off');if(!localStorage.getItem('rift-survival-profile.v1'))localStorage.setItem('rift-survival-profile.v1',JSON.stringify(profile));sessionStorage.setItem('combat-seeded','1');},profile);
 page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.log('BROWSER ERROR',error.message);});
 page.setDefaultTimeout(15000);await page.goto(`${base}/survival.html`);await ready();
}
async function buyLoadout(weapon,skill){
 await page.locator('[data-panel="shop"]').click();await page.locator(`[data-buy-weapon="${weapon}"]`).click();
 await page.locator('[data-shop-tab="skills"]').click();await page.locator('[data-buy-skill="dash"]').click();await page.locator('[data-buy-skill="bulwark"]').click();
 if(skill!=='bulwark')await page.locator(`[data-buy-skill="${skill}"]`).click();
 await page.locator('#panel-close').click();await page.reload();await ready();
 const saved=await page.evaluate(()=>{const t=window.__survivalTest;return{profile:structuredClone(t.lobby.profile),weapon:t.run.weaponId,skill:t.run.skillId,model:t.steve.weaponId};});
 assert.equal(saved.profile.weapon,weapon);assert.equal(saved.profile.skill,skill);assert.equal(saved.weapon,weapon);assert.equal(saved.skill,skill);assert.equal(saved.model,weapon);assert.deepEqual(saved.profile.ownedSkills,['bow','dash','bulwark']);
 const price=getSteveWeapon(weapon).price;assert.equal(saved.profile.wallet,loadoutBudget-price-skillCost);
 await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await phase('playing');
 assert.equal(await page.locator('#hud').getAttribute('data-weapon'),weapon);assert.equal(await page.locator('#hud').getAttribute('data-skill'),skill);
 return saved;
}
async function arrangeTarget(){
 await page.evaluate(()=>{
  const r=window.__survivalTest.run,s=r.state,p=s.player;r.obstacles=[];r._spawnClock=99999;r._nextBonusAt=99999;s.enemies=[];s.projectiles=[];s.drops=[];s.warnings=[];p.x=p.z=0;p.cooldown=0;p.invulnerable=9999;
  const e=r._spawnEnemy('walker',0,6);Object.assign(e,{hp:5000,maxHp:5000,speed:0,damage:0,attackCooldown:9999,xp:0});window.__combatTarget=e.id;
  window.__combatEvents=[];const event=r._event.bind(r);r._event=(type,data={})=>{if(['rangedshot','bowshot','super','hit','reflect','dashend'].includes(type)){window.__combatEvents.push({type,...data});if(type==='rangedshot'||type==='bowshot')window.__combatLastShot=structuredClone(s.projectiles.filter(p=>p.team==='player').at(-1));}event(type,data);};
 });
 await page.waitForFunction(()=>window.__combatEvents.some(e=>e.type==='rangedshot')&&window.__survivalTest.steve.root.userData.attackKind==='ranged');
 await page.waitForFunction(()=>window.__survivalTest.run.state.enemies.find(e=>e.id===window.__combatTarget).hp<5000);
 return page.evaluate(()=>{const t=window.__survivalTest;return{shot:window.__combatLastShot,held:t.steve.root.userData.heldWeapon,model:t.steve.weaponId,events:window.__combatEvents.filter(e=>e.type==='rangedshot'),targetHP:t.run.state.enemies.find(e=>e.id===window.__combatTarget).hp};});
}
async function pauseFreeze(){
 await page.locator('#pause').click();await phase('paused');
 const snapshot=()=>page.evaluate(()=>{const t=window.__survivalTest,s=t.run.state,p=s.player;return{elapsed:s.elapsed,skillTime:p.skillTime,bowTime:p.bowTime,bulwarkTime:p.bulwarkTime,projectiles:s.projectiles.map(p=>({id:p.id,x:p.x,z:p.z,life:p.life})),attackAge:t.steve.root.userData.attackAge};});
 const before=await snapshot();await page.waitForTimeout(280);assert.deepEqual(await snapshot(),before);
 await page.locator('#start').click();await phase('playing');return before;
}
async function rangedUpgrade(screenshot){
 await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;r.rng=()=>0;r.state.drops=[{id:987654,type:'xp',value:r.state.xpNeeded-r.state.xp,x:p.x,z:p.z}];});
 await phase('upgrade');
 const copy=await page.locator('.upgrade-choice').allTextContents();assert.equal(copy.length,3);assert.match(copy.join(' '),/Мощный выстрел/);assert.match(copy.join(' '),/Двойной выстрел/);assert.doesNotMatch(copy.join(' '),/взмах|клинок|Удары оружием|ширине взмаха/i);
 const upgradeState=await page.evaluate(()=>structuredClone(window.__survivalTest.run.state));
 assert.deepEqual(await page.locator('[data-upgrade="rate"] .upgrade-bonuses span').allTextContents(),upgradePresentation(upgradeState,'rate').bonuses);
 if(screenshot)await page.screenshot({path:screenshot});
 await page.locator('[data-upgrade="pellets"]').click();await phase('playing');
 assert.equal(await page.evaluate(()=>window.__survivalTest.run.state.upgrades.pellets),1);
 return copy;
}
try{
 for(const scenario of [
  {weapon:'hunting-bow',kind:'arrow',skill:'dash',viewport:{width:1280,height:800}},
  {weapon:'crossbow',kind:'bolt',skill:'bulwark',viewport:{width:390,height:844}},
  {weapon:'ember-staff',kind:'ember',skill:'bow',viewport:{width:844,height:390}},
 ]){
  await check(`${scenario.viewport.width}px ${scenario.weapon}: paid loadout, reload, auto-projectiles and held model`,async()=>{
   await fresh(scenario.viewport);const saved=await buyLoadout(scenario.weapon,scenario.skill),shot=await arrangeTarget();assert.equal(shot.shot.kind,scenario.kind);assert.equal(shot.held,scenario.weapon);assert.equal(shot.model,scenario.weapon);assert.equal(shot.shot.team,'player');assert.ok(shot.targetHP<5000);
   if(scenario.kind==='bolt')assert.equal(shot.shot.pierce,getSteveWeapon(scenario.weapon).pierce);if(scenario.kind==='ember'){assert.ok(shot.shot.splashRadius>0);assert.ok(shot.shot.burn>0);}
   observations[scenario.weapon]={saved,shot};
  });
  if(!context||!page||await page.evaluate(()=>!window.__survivalTest?.run))continue;
  await check(`${scenario.weapon}: real pause freezes projectiles and animation`,()=>pauseFreeze());
  if(scenario.skill==='dash')await check('Dash button moves Steve along the movement direction and hits a real enemy on the path',async()=>{
   await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;p.cooldown=999;p.super=100;p.superCooldown=0;const e=r._spawnEnemy('walker',2.8,0);Object.assign(e,{hp:5000,maxHp:5000,speed:0,damage:0,attackCooldown:9999});window.__dashTarget=e.id;});
   await page.waitForFunction(()=>!document.querySelector('#super').disabled);
   // Locate the control before holding movement. Locator auto-wait can take
   // long enough for Steve to walk past the arranged target before clicking.
   const button=await page.locator('#super').boundingBox();assert.ok(button);
   await page.mouse.move(button.x+button.width/2,button.y+button.height/2);
   await page.keyboard.down('d');await page.waitForFunction(()=>window.__survivalTest.run.state.player.moveX>.9);const before=await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player,e=r.state.enemies.find(e=>e.id===window.__dashTarget);e.x=p.x+2.8;e.z=p.z;return{x:p.x,z:p.z};});
   await page.mouse.click(button.x+button.width/2,button.y+button.height/2);await page.keyboard.up('d');await page.waitForFunction(()=>window.__combatEvents.some(e=>e.type==='super'&&e.ability==='dash')&&window.__survivalTest.run.state.player.dashTime===0);
   const data=await page.evaluate(()=>({x:window.__survivalTest.run.state.player.x,z:window.__survivalTest.run.state.player.z,activation:window.__combatEvents.find(e=>e.type==='super'&&e.ability==='dash'),hits:window.__combatEvents.filter(e=>e.type==='hit'&&e.cause==='dash'),target:window.__dashTarget}));assert.ok(data.activation.x-before.x<.8,'the arranged target must still be ahead when the real control is clicked');assert.ok(data.x-data.activation.x>4&&data.x-data.activation.x<6);assert.ok(Math.abs(data.z-data.activation.z)<.4);assert.ok(data.hits.some(e=>e.id===data.target));observations.dash={before,...data};
  });
  if(scenario.skill==='bulwark')await check('Shield button protects and reflects a real skull projectile back into its source',async()=>{
   await page.evaluate(()=>{const p=window.__survivalTest.run.state.player;p.super=100;p.superCooldown=0;p.invulnerable=0;});await page.locator('#super').click();await page.waitForFunction(()=>window.__survivalTest.run.state.player.bulwarkTime>0);
   const frozen=await pauseFreeze();assert.ok(frozen.bulwarkTime>0);
   const before=await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player,e=r.state.enemies.find(e=>e.id===window.__combatTarget);r.state.projectiles=[];p.cooldown=999;r._enemyShot(e,0,-1,6,{kind:'wither-skull',damage:13,life:3,radius:.18});window.__reflectShot=r.state.projectiles.at(-1).id;return{hp:p.hp,targetHP:e.hp};});
   await page.waitForFunction(()=>window.__combatEvents.some(e=>e.type==='reflect'));
   const reflected=await page.evaluate(()=>{const r=window.__survivalTest.run;return structuredClone(r.state.projectiles.find(p=>p.id===window.__reflectShot));});assert.equal(reflected.team,'player');assert.equal(reflected.reflected,true);assert.ok(reflected.vz>0);
   await page.waitForFunction(hp=>window.__survivalTest.run.state.enemies.find(e=>e.id===window.__combatTarget).hp<hp,before.targetHP);assert.equal(await page.evaluate(()=>window.__survivalTest.run.state.player.hp),before.hp);
   await page.screenshot({path:'game/artifacts/combat-crossbow-shield-390.png'});observations.reflection={before,reflected};
  });
  if(scenario.skill==='bow')await check('Bow skill temporarily equips the bow and improves ranged attack cadence',async()=>{
   await page.evaluate(()=>{const p=window.__survivalTest.run.state.player;p.super=100;p.superCooldown=0;});await page.locator('#super').click();await page.waitForFunction(()=>window.__combatEvents.some(e=>e.type==='bowshot')&&window.__survivalTest.steve.root.userData.heldWeapon==='bow');
   const data=await page.evaluate(()=>({shot:window.__combatLastShot,p:structuredClone(window.__survivalTest.run.state.player),held:window.__survivalTest.steve.root.userData.heldWeapon}));assert.equal(data.shot.kind,'arrow');assert.ok(data.p.bowTime>0);assert.ok(data.p.cooldown<data.p.weapon.fireInterval);assert.ok(data.shot.damage>=data.p.weapon.damage);observations.bowSkill=data;
  });
  await check(`${scenario.weapon}: actual XP choice uses ranged upgrade descriptions`,async()=>{observations[scenario.weapon].upgrades=await rangedUpgrade(scenario.weapon==='ember-staff'?'game/artifacts/combat-staff-upgrades-844.png':null);});
  await context.close();context=null;page=null;
 }
 await check('Dev credit page grants exactly once, preserves purchases and updates a paused original tab',async()=>{
  await fresh({width:1280,height:800},{wallet:73,owned:['teal','amber'],equipped:'amber',ownedWeapons:['wooden-sword','crossbow'],weapon:'crossbow',ownedSkills:['bow','bulwark'],skill:'bulwark',claims:['first'],runs:[],musicVolume:.44,sfxVolume:.77});
  await page.locator('#start').click();await page.locator('#launch-run').click();await phase('playing');await page.locator('#pause').click();await phase('paused');
  const before=await page.evaluate(()=>{window.__originalCreditRun=window.__survivalTest.run.state;return structuredClone(window.__survivalTest.lobby.profile);});
  const grant=await context.newPage();grant.on('pageerror',e=>errors.push(e.message));await grant.goto(`${base}/dev-credit.html`);await grant.waitForFunction(()=>document.querySelector('#title').textContent==='+100 000 осколков');
  await page.waitForFunction(()=>window.__survivalTest.lobby.profile.wallet===100073);
  const after=await page.evaluate(()=>({profile:structuredClone(window.__survivalTest.lobby.profile),same:window.__originalCreditRun===window.__survivalTest.run.state,phase:window.__survivalTest.run.state.phase,walletText:document.querySelector('#wallet-value').textContent}));
  assert.equal(after.same,true);assert.equal(after.phase,'paused');assert.equal(after.profile.wallet,100073);const{wallet:beforeWallet,...beforeRest}=before,{wallet:afterWallet,...afterRest}=after.profile;assert.deepEqual(afterRest,beforeRest);assert.equal(after.walletText.replace(/\D/g,''),'100073');
  await grant.reload();await grant.waitForFunction(()=>document.querySelector('#title').textContent==='Пополнение уже получено');assert.equal(await grant.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')).wallet),100073);
  await grant.close();await page.bringToFront();await page.locator('#back-lobby').click();await phase('retired');await page.locator('#back-lobby').click();await phase('ready');const wallet=await page.evaluate(()=>window.__survivalTest.lobby.profile.wallet);
  await page.locator('[data-panel="shop"]').click();await page.locator('[data-buy-weapon="hunting-bow"]').click();assert.equal(await page.evaluate(()=>window.__survivalTest.lobby.profile.wallet),wallet-getSteveWeapon('hunting-bow').price);observations.credit={before,after};
  await context.close();context=null;page=null;
 });
 await check('No uncaught JavaScript errors',()=>assert.deepEqual(errors,[]));
}finally{await context?.close();await browser.close();await writeFile('game/artifacts/combat-integration-results.json',JSON.stringify({testedAt:new Date().toISOString(),results,errors,observations},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
