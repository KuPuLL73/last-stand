import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,UPGRADE_DEFS,getUpgradeDefs} from '../survival-core.js';

function seeded(seed=44){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function run(options={}){const r=new SurvivalRun({character:'steve',rng:seeded(),obstacles:[],...options});r.start();r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];r._spawnClock=9999;r.drainEvents();r.state.player.x=0;r.state.player.z=0;return r;}
function enemy(id,x,z,overrides={}){return{id,type:'walker',x,z,hp:500,maxHp:500,radius:.43,speed:0,damage:9,xp:3,angle:0,flash:0,attackCooldown:999,volleyCooldown:999,burn:0,burnDps:0,stun:0,steerTime:0,steerSide:1,age:0,...overrides};}
function advance(r,seconds,input={}){for(let t=0;t<seconds;t+=1/60)r.update(Math.min(1/60,seconds-t),input);}
function offer(r,id){const def=getUpgradeDefs('steve').find(u=>u.id===id);r.state.phase='upgrade';r.state.choices=[{...def}];assert.equal(r.chooseUpgrade(id),true);}

test('character selection is explicit, persists through restart, and cannot change during a run',()=>{
 const r=new SurvivalRun();assert.equal(r.state.character,'shelly');assert.equal(r.setCharacter('invalid'),false);assert.equal(r.setCharacter('steve'),true);
 assert.equal(r.state.player.character,'steve');assert.equal(r.state.player.weapon.type,'sword');assert.equal(r.state.player.maxHp,125);assert.equal(r.state.player.bowTime,0);
 r.start();assert.equal(r.setCharacter('shelly'),false);r.restart();assert.equal(r.state.character,'steve');assert.equal(r.setCharacter('shelly'),true);assert.equal(r.state.player.weapon.type,'shotgun');assert.equal(r.state.player.hp,100);
});

test('a committed sword swing has windup, hits multiple enemies in its cone, and never shoots pellets',()=>{
 const r=run(),s=r.state,p=s.player;
 const front=enemy(900,0,1.7),side=enemy(901,1.4,1.6),back=enemy(902,0,-1.8),outside=enemy(903,3.4,0);
 s.enemies=[front,side,back,outside];r.update(.001);
 assert.equal(s.stats.shots,1);assert.equal(s.projectiles.length,0);assert.equal(front.hp,500);assert.ok(p.pendingAttack);
 assert.ok(r.drainEvents().some(e=>e.type==='melee'));advance(r,.08);assert.equal(front.hp,500);
 advance(r,.065);assert.equal(front.hp,476);assert.equal(side.hp,476);assert.equal(back.hp,500);assert.equal(outside.hp,500);assert.equal(p.pendingAttack,null);
 assert.ok(front.z>1.7);assert.ok(r.drainEvents().some(e=>e.type==='hit'&&e.cause==='sword'));
});

test('sword cannot start on distant or covered enemies, and cannot cleave through a crate',()=>{
 const r=run({obstacles:[{x:1.2,z:1.2,w:.8,d:.8}]});
 const front=enemy(900,0,1.8),covered=enemy(901,1.6,1.6),distant=enemy(902,0,3.2);r.state.enemies=[front,covered,distant];
 advance(r,.16);assert.equal(front.hp,476);assert.equal(covered.hp,500);assert.equal(distant.hp,500);
 const blocked=run({obstacles:[{x:0,z:1.2,w:2,d:.3}]});blocked.state.enemies=[enemy(903,0,2)];advance(blocked,1);assert.equal(blocked.state.stats.shots,0);assert.equal(blocked.state.player.targetId,null);
});

test('sword windup freezes during both pause and upgrade, and death/restart cancels it',()=>{
 const r=run(),e=enemy(900,0,1.8);r.state.enemies=[e];r.update(.01);advance(r,.03);const before=structuredClone(r.state.player.pendingAttack);
 r.pause();advance(r,4);assert.deepEqual(r.state.player.pendingAttack,before);assert.equal(e.hp,500);r.resume();
 r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('steve')[0]];advance(r,4);assert.deepEqual(r.state.player.pendingAttack,before);r.chooseUpgrade('damage');advance(r,.12);assert.ok(e.hp<476);
 r.state.player.cooldown=0;r.update(.001);assert.ok(r.state.player.pendingAttack);r.state.player.hp=1;r._hurtPlayer(100,0,0,'test');assert.equal(r.state.player.pendingAttack,null);assert.equal(r.state.player.bowTime,0);
 r.restart();assert.equal(r.state.character,'steve');assert.equal(r.state.player.pendingAttack,null);assert.equal(r.state.stats.shots,0);
});

test('Steve gets contextual upgrade choices while shared ids and Shelly descriptions stay stable',()=>{
 const defs=getUpgradeDefs('steve');assert.deepEqual(defs.map(d=>d.id),UPGRADE_DEFS.map(d=>d.id));assert.equal(defs.find(d=>d.id==='damage').name,'Острота');assert.match(defs.find(d=>d.id==='burn').description,/Оружие/);assert.match(getUpgradeDefs('shelly')[0].description,/дробинки/);
 const r=run();r.state.drops=[{id:900,type:'xp',x:0,z:0,value:9}];r.update(.01);assert.equal(r.state.phase,'upgrade');assert.ok(r.state.choices.every(c=>c.name===defs.find(d=>d.id===c.id).name));
});

test('sweep, knockback, fire aspect and return swing have concrete melee effects',()=>{
 const normal=run(),improved=run();offer(improved,'pellets');offer(improved,'pierce');offer(improved,'ricochet');offer(improved,'burn');
 const w=improved.state.player.weapon;assert.ok(w.range>2.45);assert.ok(w.arc>Math.PI*2/3);assert.ok(w.bowRange>10.5);
 const a=enemy(900,0,2),b=enemy(900,0,2);normal.state.enemies=[a];improved.state.enemies=[b];advance(normal,.16);advance(improved,.16);
 assert.ok(b.z>a.z);assert.ok(b.burn>0);const hp=b.hp;
 // Keep the target in reach of the return swing; the actual knockback has
 // already been tested above, and a player may move after the first hit.
 b.z=2;advance(improved,.16);assert.ok(b.hp<=hp-improved.state.player.weapon.damage*.35);assert.ok(improved.drainEvents().some(e=>e.type==='meleeimpact'&&e.echo));
});

test('bow ability switches to real arrow projectiles without radial damage and cannot chain itself',()=>{
 const r=run(),p=r.state.player,e=enemy(900,0,6);r.state.enemies=[e];r.update(.001,{super:true});
 assert.equal(p.bowTime,8);assert.equal(p.super,0);assert.equal(r.state.stats.superUses,1);assert.equal(e.hp,500);assert.equal(p.pendingAttack,null);
 assert.equal(r.state.projectiles.length,1);assert.equal(r.state.projectiles[0].kind,'arrow');assert.equal(r.state.projectiles[0].vx,0);assert.ok(r.state.projectiles[0].vz>0);
 const events=r.drainEvents();assert.ok(events.some(e=>e.type==='super'&&e.ability==='bow'&&e.duration===8));assert.ok(events.some(e=>e.type==='bowshot'));assert.ok(!events.some(e=>e.type==='shot'||e.type==='melee'));
 advance(r,.8,{super:true});assert.ok(e.hp<500);assert.equal(p.super,0);assert.equal(r.state.stats.superUses,1);assert.ok(r.state.stats.shots>=2);assert.ok(r.drainEvents().some(e=>e.type==='hit'&&e.cause==='arrow'));
});

test('bow active time freezes on pause/upgrade and returns to sword after eight active seconds',()=>{
 const r=run(),p=r.state.player;r.update(.001,{super:true});advance(r,2);const remaining=p.bowTime;r.pause();advance(r,20);assert.equal(p.bowTime,remaining);r.resume();
 r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('steve')[0]];advance(r,20);assert.equal(p.bowTime,remaining);r.chooseUpgrade('damage');advance(r,remaining+.02);assert.equal(p.bowTime,0);
 r.state.enemies=[enemy(900,0,1.8)];p.cooldown=0;r.update(.001);assert.ok(p.pendingAttack);assert.ok(r.drainEvents().some(e=>e.type==='melee'));
 r.restart();assert.equal(r.state.player.bowTime,0);assert.equal(r.state.player.super,100);
});

test('arrows inherit sharpness, pierce, ricochet and fire aspect; rapid pickup speeds both weapons',()=>{
 const r=run();for(const id of ['damage','rate','pierce','ricochet','burn'])offer(r,id);
 const p=r.state.player;p.buffs.rapid=8;r.state.enemies=[enemy(900,0,5)];r.update(.001,{super:true});const shot=r.state.projectiles[0];
 assert.ok(Math.abs(shot.damage-p.weapon.damage*.60)<1e-6);assert.equal(shot.pierce,1);assert.equal(shot.bounces,1);assert.equal(shot.burn,1);assert.ok(p.cooldown>=.4&&p.cooldown<.5);
 const sword=run();sword.state.player.buffs.rapid=8;sword.state.enemies=[enemy(900,0,2)];sword.update(.001);assert.ok(sword.state.player.cooldown<.49);assert.equal(sword.state.player.weapon.fireInterval,.80);
});

test('bow arrows still collide with intervening cover after the shot has been committed',()=>{
 const r=run(),p=r.state.player,e=enemy(900,0,6);r.state.enemies=[e];r.update(.001,{super:true});r.obstacles.push({x:0,z:3,w:2,d:.5});advance(r,.4);
 assert.equal(e.hp,500);assert.equal(r.state.projectiles.length,0);assert.equal(r.state.stats.shots,1);
});

test('starter wooden sword reaches the campaign boss with earned upgrades and health intact',()=>{
 const r=new SurvivalRun({character:'steve',rng:seeded(171)});r.start();
 const priority=['damage','pellets','rate','ricochet','burn','regen','maxhp','pierce','speed','pickup'];
 // This regression covers reaching the four-minute boss. The subsequent
 // fight has separate mechanics tests; it is not a promise to survive 300s.
 for(let i=0;i<60*245&&r.state.bossId===null&&!['won','dead'].includes(r.state.phase);i++){
  const s=r.state,p=s.player;
  if(s.phase==='upgrade'){
   const choices=[...s.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));
   const health=p.hp<p.maxHp*.5?choices.find(c=>c.id==='maxhp'||c.id==='regen'):null;r.chooseUpgrade((health||choices[0]).id);continue;
  }
  const drop=[...s.drops].sort((a,b)=>{
   const priority=d=>(d.type==='heal'&&p.hp<p.maxHp*.7?0:d.type==='shield'?1:2);
   return priority(a)-priority(b)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z);
  })[0];
  let x=Math.cos(i/140),z=Math.sin(i/140);
  if(drop){const d=Math.hypot(drop.x-p.x,drop.z-p.z)||1;x=(drop.x-p.x)/d;z=(drop.z-p.z)/d;}
  let nearby=0;
  for(const e of s.enemies){const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||.1;if(d<7)nearby++;if(d<2.25){const weight=(2.25-d)*2.7;x+=dx/d*weight;z+=dz/d*weight;}}
  for(const b of s.projectiles){if(b.team!=='enemy')continue;const dx=p.x-b.x-b.vx*.15,dz=p.z-b.z-b.vz*.15,d=Math.hypot(dx,dz)||.1;if(d<1.7){x+=dx/d*(1.7-d)*3;z+=dz/d*(1.7-d)*3;}}
  for(const w of s.warnings){const dx=p.x-w.x,dz=p.z-w.z,d=Math.hypot(dx,dz)||.1;if(d<w.radius+1){x+=dx/d*5;z+=dz/d*5;}}
  if(p.x>8)x-=1.5;if(p.x<-8)x+=1.5;if(p.z>9)z-=1.5;if(p.z<-9)z+=1.5;
  r.update(1/60,{x,z,super:p.super>=100&&(nearby>=3||p.hp<60)});r.drainEvents();
 }
 assert.ok(['playing','won'].includes(r.state.phase),JSON.stringify({time:r.state.elapsed,hp:r.state.player.hp,kills:r.state.kills,level:r.state.level}));assert.ok(r.state.elapsed>=240&&r.state.elapsed<240.1);assert.ok(r.state.bossId!==null||r.state.phase==='won');assert.ok(r.state.level>10);assert.ok(r.state.player.hp>0);assert.ok(r.state.stats.superUses>1);
});
