import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,UPGRADE_DEFS} from '../survival-core.js';

function seeded(seed=1){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function run(options={}){const result=new SurvivalRun({rng:seeded(44),...options});result.start();result.drainEvents();return result;}
function advance(game,seconds,input={}){for(let t=0;t<seconds;t+=1/60)game.update(Math.min(1/60,seconds-t),input);}
function enemy(id,x,z,options={}){return{id,type:'walker',x,z,hp:40,maxHp:40,radius:.43,speed:0,damage:9,xp:3,angle:0,flash:0,attackCooldown:999,volleyCooldown:999,burn:0,burnDps:0,stun:0,steerTime:0,steerSide:1,age:0,...options};}
function isolate(game){game.state.enemies=[];game.state.projectiles=[];game.state.drops=[];game._spawnClock=9999;}
function offer(game,id){const choice=UPGRADE_DEFS.find(x=>x.id===id);game.state.phase='upgrade';game.state.choices=[{...choice,rank:game.state.upgrades[id]+1}];assert.equal(game.chooseUpgrade(id),true);}

test('start, safe initial enemies, restart and manual pause preserve run state',()=>{
 const game=new SurvivalRun({rng:seeded(1)});assert.equal(game.state.phase,'ready');assert.equal(game.start(),true);assert.equal(game.start(),false);assert.equal(game.state.player.super,100);
 assert.equal(game.state.enemies.length,3);assert.ok(game.state.enemies.every(e=>Math.hypot(e.x,e.z-6.8)>4));
 advance(game,.3,{x:1});const before=structuredClone(game.state);assert.equal(game.pause(),true);advance(game,2,{z:1,super:true});assert.deepEqual(game.state,{...before,phase:'paused'});assert.equal(game.resume(),true);advance(game,.2,{x:1});assert.ok(game.state.player.x>before.player.x);
 game.restart();assert.equal(game.state.phase,'ready');assert.equal(game.state.kills,0);assert.equal(game.state.enemies.length,0);assert.equal(game.state.player.hp,100);
});

test('diagonal movement is normalized and cannot cross the arena or cover',()=>{
 const a=run({obstacles:[]}),b=run({obstacles:[]});isolate(a);isolate(b);advance(a,1,{x:1,z:0});advance(b,1,{x:1,z:1});
 assert.ok(Math.abs(Math.hypot(b.state.player.x,b.state.player.z-6.8)-Math.hypot(a.state.player.x,a.state.player.z-6.8))<.001);
 advance(a,10,{x:1});assert.ok(a.state.player.x<=a.bounds.maxX-a.state.player.radius+.001);
 const cover=run({obstacles:[{x:0,z:3,w:3,d:1}]});isolate(cover);advance(cover,3,{z:-1});assert.ok(cover.state.player.z>=3.5+cover.state.player.radius-.001);
});

test('automatic fire picks the closest visible enemy instead of a closer covered one',()=>{
 const game=run({obstacles:[{x:0,z:4,w:2,d:.5}]});isolate(game);
 game.state.enemies=[enemy(900,0,3.5),enemy(901,3,3.5)];game.update(1/60,{});
 assert.equal(game.state.player.targetId,901);assert.equal(game.state.stats.shots,1);assert.equal(game.state.projectiles.length,5);
 game.state.projectiles=[];game.state.enemies=[enemy(902,0,3.5)];game.state.player.cooldown=0;game.update(1/60,{});
 assert.equal(game.state.player.targetId,null);assert.equal(game.state.stats.shots,1);
});

test('automatic shots damage enemies and drop XP without ammunition state or reload events',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player;game.state.enemies=[enemy(900,0,3.3,{hp:120,maxHp:120})];
 game.update(.01,{});assert.equal(game.state.stats.shots,1);
 advance(game,2.7);assert.ok(game.state.kills>=1);assert.ok(game.state.drops.length>0);assert.ok(game.state.stats.damageDealt>=120);
 advance(game,3);const events=game.drainEvents();assert.ok(events.some(e=>e.type==='kill'&&e.enemyType==='walker'));assert.ok(events.every(e=>e.type!=='reload'));assert.ok(events.filter(e=>e.type==='shot').every(e=>!Object.hasOwn(e,'ammo')));
 for(const key of ['ammo','maxAmmo','reload'])assert.equal(Object.hasOwn(p,key),false);
 assert.equal(Object.hasOwn(p.weapon,'reloadTime'),false);
});

test('automatic fire keeps one steady cadence beyond the former three-shot cycle',()=>{
 const game=run({obstacles:[]});isolate(game);
 game.state.enemies=[enemy(900,0,3.3,{hp:100000,maxHp:100000})];
 const shots=[];
 for(let i=0;i<60*6.3;i++){
  game.update(1/60,{});
  for(const event of game.drainEvents())if(event.type==='shot')shots.push(game.state.elapsed);
 }
 assert.equal(game.state.player.weapon.fireInterval,.68);
 assert.ok(shots.length>=9,JSON.stringify(shots));
 for(let i=1;i<shots.length;i++)assert.ok(Math.abs(shots[i]-shots[i-1]-.68)<=1/60+.0001,JSON.stringify(shots));
 assert.equal(game.state.stats.shots,shots.length);
});

test('time without a visible target never banks instant follow-up shots',()=>{
 const game=run({obstacles:[]});isolate(game);advance(game,20);
 assert.equal(game.state.stats.shots,0);assert.equal(game.state.player.cooldown,0);
 game.state.enemies=[enemy(900,0,3.3,{hp:100000,maxHp:100000})];
 game.update(.001);assert.equal(game.state.stats.shots,1);
 advance(game,.66);assert.equal(game.state.stats.shots,1);
 advance(game,.04);assert.equal(game.state.stats.shots,2);
 game.state.enemies=[];advance(game,10);
 game.state.enemies=[enemy(901,0,3.3,{hp:100000,maxHp:100000})];
 game.update(.001);assert.equal(game.state.stats.shots,3);
 advance(game,.05);assert.equal(game.state.stats.shots,3);
});

test('pause freezes the remaining firing cooldown and resumes the same rhythm',()=>{
 const game=run({obstacles:[]});isolate(game);
 game.state.enemies=[enemy(900,0,3.3,{hp:100000,maxHp:100000})];
 game.update(.01);advance(game,.2);const cooldown=game.state.player.cooldown,elapsed=game.state.elapsed;
 assert.equal(game.state.stats.shots,1);assert.ok(cooldown>0);
 game.pause();game.update(100);assert.equal(game.state.player.cooldown,cooldown);assert.equal(game.state.elapsed,elapsed);assert.equal(game.state.stats.shots,1);
 game.resume();advance(game,cooldown-.02);assert.equal(game.state.stats.shots,1);
 advance(game,.04);assert.equal(game.state.stats.shots,2);
});

test('projectiles do not tunnel through enemies or ignore intervening cover',()=>{
 const game=run({obstacles:[{x:0,z:4,w:2,d:.25}]});isolate(game);game.state.player.cooldown=999;game.state.enemies=[enemy(900,0,2)];
 game.state.projectiles=[{id:999,team:'player',x:0,z:6,vx:0,vz:-200,life:1,radius:.07,damage:50,pierce:0,bounces:0,burn:0,hitIds:[]}];
 game.update(.04,{});assert.equal(game.state.enemies[0].hp,40);assert.equal(game.state.projectiles.length,0);
 const open=run({obstacles:[]});isolate(open);open.state.player.cooldown=999;open.state.enemies=[enemy(900,0,2)];open.state.projectiles=[{id:999,team:'player',x:0,z:6,vx:0,vz:-200,life:1,radius:.07,damage:50,pierce:0,bounces:0,burn:0,hitIds:[]}];open.update(.04,{});assert.equal(open.state.kills,1);
});

test('experience attracts to the player, pauses at level-up and offers three unique valid upgrades',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.drops=[{id:900,x:1,z:6.8,value:9,type:'xp'}];
 advance(game,1);assert.equal(game.state.phase,'upgrade');assert.equal(game.state.level,2);assert.equal(game.state.choices.length,3);assert.equal(new Set(game.state.choices.map(c=>c.id)).size,3);
 const elapsed=game.state.elapsed;advance(game,10,{x:1});assert.equal(game.state.elapsed,elapsed);assert.equal(game.chooseUpgrade('not-a-choice'),false);assert.equal(game.state.phase,'upgrade');
 const choice=game.state.choices[0].id;assert.equal(game.chooseUpgrade(choice),true);assert.equal(game.state.upgrades[choice],1);assert.equal(game.state.phase,'playing');
});

test('pause on the upgrade screen restores the pending choice rather than skipping it',()=>{
 const game=run();game.state.phase='upgrade';game.state.choices=UPGRADE_DEFS.slice(0,3);game.pause();assert.equal(game.state.phase,'paused');game.resume();assert.equal(game.state.phase,'upgrade');assert.equal(game.state.choices.length,3);
});

test('all ten upgrades have observable, cumulative gameplay effects',()=>{
 const game=run();isolate(game);const p=game.state.player,w=p.weapon;
 const previous={damage:w.damage,rate:w.fireInterval,pellets:w.pellets,speed:p.speed,pickup:p.pickupRadius};
 p.hp=40;for(const upgrade of UPGRADE_DEFS)offer(game,upgrade.id);
 assert.ok(w.damage>previous.damage);assert.equal(w.fireInterval,previous.rate*.84);assert.equal(w.pellets,previous.pellets+2);assert.equal(w.pierce,1);assert.equal(w.ricochet,1);assert.equal(w.burn,1);assert.ok(p.speed>previous.speed);assert.equal(p.maxHp,125);assert.equal(p.hp,70);assert.ok(p.regen>0);assert.ok(p.pickupRadius>previous.pickup);assert.ok(p.xpMultiplier>1);
 advance(game,2);assert.ok(p.hp>70);assert.equal(game.state.upgrades['shrapnel-line'],0,'a base upgrade does not grant the combination');
});

test('piercing hits two enemies and ricochet reflects from cover',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.cooldown=999;
 game.state.enemies=[enemy(900,0,3),enemy(901,0,1.8)];game.state.projectiles=[{id:999,team:'player',x:0,z:4,vx:0,vz:-30,life:.3,radius:.07,damage:50,pierce:1,bounces:0,burn:0,hitIds:[]}];advance(game,.2);assert.equal(game.state.kills,2);
 const wall=run({obstacles:[{x:0,z:4,w:2,d:.5}]});isolate(wall);wall.state.player.cooldown=999;wall.state.projectiles=[{id:999,team:'player',x:0,z:5,vx:0,vz:-30,life:.5,radius:.07,damage:11,pierce:0,bounces:1,burn:0,hitIds:[]}];advance(wall,.04);assert.equal(wall.state.projectiles.length,1);assert.ok(wall.state.projectiles[0].vz>0);assert.equal(wall.state.projectiles[0].bounces,0);
});

test('burn continues to damage after the projectile has disappeared',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.cooldown=999;game.state.enemies=[enemy(900,0,3,{hp:100,maxHp:100})];game.state.projectiles=[{id:999,team:'player',x:0,z:4,vx:0,vz:-30,life:.3,radius:.07,damage:10,pierce:0,bounces:0,burn:1,hitIds:[]}];advance(game,.1);assert.equal(game.state.projectiles.length,0);const hp=game.state.enemies[0].hp;advance(game,1);assert.ok(game.state.enemies[0].hp<hp-7);
});

test('contact immunity prevents piled enemies from deleting all health in one frame',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.cooldown=999;game.state.enemies=Array.from({length:8},(_,i)=>enemy(900+i,0,6.8));
 game.update(.01);assert.equal(game.state.player.hp,91);advance(game,.5);assert.equal(game.state.player.hp,91);advance(game,.3);assert.ok(game.state.player.hp<91);assert.ok(game.state.player.hp>=82);
});

test('super is available at the start, damages and pushes enemies, and cannot spam itself',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.cooldown=999;game.state.enemies=[enemy(900,0,3,{hp:240,maxHp:240,speed:0})];
 game.update(.01,{super:true});const e=game.state.enemies[0];assert.ok(e.hp<240);assert.ok(e.z<3);assert.equal(game.state.player.super,0);assert.equal(game.state.stats.superUses,1);
 advance(game,.2,{super:true});assert.equal(game.state.stats.superUses,1);
});

test('enemy navigation slides around a crate instead of becoming permanently stuck',()=>{
 const game=run({obstacles:[{x:0,z:3,w:2,d:1}]});isolate(game);game.state.player.cooldown=999;
 const e=enemy(900,0,0,{speed:1.4});game.state.enemies=[e];advance(game,6);assert.ok(e.z>3.5||Math.abs(e.x)>1.1,JSON.stringify({x:e.x,z:e.z}));
});

test('spawn pressure escalates, includes runners and spitters, and never exceeds the enemy cap',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.elapsed=110;game._spawnClock=0;game.state.player.hp=1e6;game.state.player.maxHp=1e6;game.state.player.cooldown=999;
 advance(game,90,{x:.7,z:.3});const types=new Set(game.state.enemies.map(e=>e.type));assert.ok(types.has('walker'));assert.ok(types.has('runner'));assert.ok(types.has('spitter'));assert.ok(game.state.enemies.length<=60);assert.ok(game.state.wave>=4);assert.ok(game.state.projectiles.some(p=>p.team==='enemy')||game.drainEvents().some(e=>e.type==='enemyshot'));
});

test('surviving the timer spawns a boss; only defeating it wins the run',()=>{
 const game=run({duration:1,obstacles:[]});isolate(game);advance(game,1.1);assert.equal(game.state.remaining,0);assert.ok(game.state.bossId);assert.equal(game.state.phase,'playing');
 const boss=game.state.enemies.find(e=>e.id===game.state.bossId);assert.equal(boss.type,'boss');assert.ok(boss.hp>0);
 game.state.enemies=[boss];boss.x=0;boss.z=3;boss.hp=1;game.state.player.cooldown=0;advance(game,.3);assert.equal(game.state.phase,'won');assert.ok(game.drainEvents().some(e=>e.type==='win'));
 const time=game.state.elapsed;advance(game,5,{x:1});assert.equal(game.state.elapsed,time);
});

test('boss slam warns before damage and moving out of the marked area avoids it',()=>{
 const game=run({duration:.1,obstacles:[]});isolate(game);game.state.player.cooldown=999;advance(game,.15);const boss=game.state.enemies.find(e=>e.type==='boss');boss.x=0;boss.z=-5;boss.speed=0;boss.attackCooldown=0;boss.volleyCooldown=999;
 game.update(.01);assert.equal(game.state.warnings.length,1);const warning=game.state.warnings[0],hp=game.state.player.hp;assert.ok(warning.remaining>1.2);advance(game,.8,{x:1});assert.equal(game.state.player.hp,hp);advance(game,.6,{x:1});assert.equal(game.state.warnings.length,0);assert.equal(game.state.player.hp,hp);const events=game.drainEvents();assert.ok(events.some(e=>e.type==='warning'));assert.ok(events.some(e=>e.type==='slam'));
});

test('fatal damage ends the run and cannot be undone by a later boss hit in the same tick',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.hp=1;game.state.player.cooldown=999;game.state.enemies=[enemy(900,0,6.8),enemy(901,0,3,{type:'boss',hp:1,maxHp:100,radius:1})];game.state.bossId=901;
 game.state.projectiles=[{id:999,team:'player',x:0,z:4,vx:0,vz:-200,life:1,radius:.07,damage:50,pierce:0,bounces:0,burn:0,hitIds:[]}];game.update(.04);assert.equal(game.state.phase,'dead');assert.ok(game.drainEvents().some(e=>e.type==='lose'));const elapsed=game.state.elapsed;advance(game,2);assert.equal(game.state.elapsed,elapsed);
});

test('a complete four-minute survival run can reach upgrades, the boss and victory without stat cheats',()=>{
 const game=new SurvivalRun({rng:seeded(1)});game.start();
 const priority=['pellets','damage','pierce','rate','regen','maxhp','burn','speed','pickup','ricochet'];
 let maximumEnemies=0;
 for(let i=0;i<60*290&&!['won','dead'].includes(game.state.phase);i++){
  const s=game.state,p=s.player;
  if(s.phase==='upgrade'){
   const choices=[...s.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));
   const health=p.hp<p.maxHp*.45?choices.find(c=>c.id==='maxhp'||c.id==='regen'):null;
   game.chooseUpgrade((health||choices[0]).id);continue;
  }
  const drop=[...s.drops].sort((a,b)=>{const priority=d=>d.type==='heal'&&p.hp<p.maxHp*.6?0:d.type==='shield'?1:2;return priority(a)-priority(b)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z);})[0];
  let x=Math.cos(i/140),z=Math.sin(i/140);
  if(drop){const distance=Math.hypot(drop.x-p.x,drop.z-p.z)||1;x=(drop.x-p.x)/distance;z=(drop.z-p.z)/distance;}
  let nearby=0;
  for(const e of s.enemies){const dx=p.x-e.x,dz=p.z-e.z,distance=Math.hypot(dx,dz)||.1;if(distance<6)nearby++;if(distance<2.3){const weight=(2.3-distance)*1.9;x+=dx/distance*weight;z+=dz/distance*weight;}}
  // With rarer pickups, actually dodge visible enemy shots rather than tanking
  // every projectile and relying on repeated medicine/shield rolls.
  for(const shot of s.projectiles){if(shot.team!=='enemy')continue;const dx=p.x-shot.x-shot.vx*.15,dz=p.z-shot.z-shot.vz*.15,d=Math.hypot(dx,dz)||.1;if(d<1.7){x+=dx/d*(1.7-d)*3;z+=dz/d*(1.7-d)*3;}}
  for(const warning of s.warnings){const dx=p.x-warning.x,dz=p.z-warning.z,distance=Math.hypot(dx,dz)||.1;if(distance<warning.radius+1){x+=dx/distance*5;z+=dz/distance*5;}}
  if(p.x>8)x-=1.5;if(p.x<-8)x+=1.5;if(p.z>9)z-=1.5;if(p.z<-9)z+=1.5;
  game.update(1/60,{x,z,super:p.super>=100&&(nearby>=4||p.hp<45)});game.drainEvents();
  maximumEnemies=Math.max(maximumEnemies,s.enemies.length);
 }
 assert.equal(game.duration,240);assert.equal(game.state.phase,'won');assert.ok(game.state.elapsed>=240);assert.ok(game.state.level>10);assert.ok(game.state.kills>100);assert.ok(game.state.stats.superUses>0);assert.ok(maximumEnemies<=60);assert.ok(game.state.drops.length<=100);assert.ok(game.state.player.hp>0);
});

function bonus(game,type,overrides={}){return{id:90000+game.state.drops.length,type,x:game.state.player.x,z:game.state.player.z,value:0,radius:.30,life:20,...overrides};}
function killingShot(id){return{id,team:'player',x:0,z:.5,vx:0,vz:-30,life:.3,radius:.07,damage:50,pierce:0,bounces:0,burn:0,hitIds:[]};}

test('zombie kills keep guaranteed XP and six-percent eligible bonus rolls',()=>{
 const game=run({obstacles:[],rng:seeded(194)});isolate(game);game.state.player.cooldown=999;
 let bonusCount=0;const types=new Set();
 for(let i=0;i<10000;i++){
  game.state.elapsed=i*9;game.state.drops=[];
  const target=enemy(10000+i,0,0,{hp:1,maxHp:1});game.state.enemies=[target];
  game._damageEnemy(target,1,'test');
  assert.equal(game.state.drops.filter(d=>d.type==='xp').length,1);
  const rewards=game.state.drops.filter(d=>d.type!=='xp');assert.ok(rewards.length<=1);
  for(const reward of rewards){bonusCount++;types.add(reward.type);assert.equal(reward.radius,.30);assert.equal(reward.life,20);}
  game.drainEvents();
 }
 assert.ok(bonusCount>=500&&bonusCount<=700,`${bonusCount}/10000`);
 assert.deepEqual([...types].sort(),['haste','heal','magnet','rapid','shield']);
 const unlucky=run({obstacles:[],rng:()=>.99});isolate(unlucky);unlucky.state.player.hp=1;unlucky.state.player.cooldown=999;
 unlucky.state.enemies=[enemy(900,0,0,{hp:1,maxHp:1})];unlucky.state.projectiles=[killingShot(999)];unlucky.update(.001);
 assert.ok(unlucky.state.drops.every(d=>d.type==='xp'),'healing is not guaranteed for a wounded player');
});

test('the experience cap merges only XP and never adds its value to bonus pickups',()=>{
 const game=run({obstacles:[],rng:()=>.99});isolate(game);game.state.player.cooldown=999;
 game.state.drops=Array.from({length:85},(_,i)=>({id:1000+i,type:'xp',x:0,z:0,value:3,radius:.16}));
 const medicine=bonus(game,'heal',{x:0,z:0});game.state.drops.unshift(medicine);
 game.state.enemies=[enemy(900,0,0,{hp:1,maxHp:1})];game.state.projectiles=[killingShot(999)];game.update(.001);
 assert.equal(game.state.drops.filter(d=>d.type==='xp').length,85);assert.equal(game.state.drops.filter(d=>d.type==='xp').reduce((sum,d)=>sum+d.value,0),258);
 assert.equal(medicine.value,0);assert.equal(medicine.type,'heal');assert.equal(game.state.drops.length,86);
});

test('medicine heals twenty-five health, clamps to the maximum and emits a typed pickup',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.player.hp=55;game.state.drops=[bonus(game,'heal')];game.update(.001);
 assert.equal(game.state.player.hp,80);assert.equal(game.state.stats.bonuses,1);
 game.state.drops=[bonus(game,'heal')];game.update(.001);assert.equal(game.state.player.hp,100);
 const events=game.drainEvents();assert.ok(events.some(e=>e.type==='pickup'&&e.dropType==='heal'));assert.ok(events.some(e=>e.type==='bonus'&&e.bonus==='heal'&&e.amount===20));
});

test('haste temporarily adds thirty-five percent movement speed and refreshes without stacking',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player,base=p.speed;
 game.state.drops=[bonus(game,'haste'),bonus(game,'haste',{id:90001})];game.update(.001);
 assert.equal(p.buffs.haste,10);assert.equal(p.speed,base);
 const x=p.x;advance(game,1,{x:1});assert.ok(Math.abs(p.x-x-base*1.35)<.001);assert.equal(p.speed,base);
 advance(game,9.1);assert.equal(p.buffs.haste,0);p.x=0;const before=p.x;advance(game,.1,{x:1});assert.ok(Math.abs(p.x-before-base*.1)<.001);
});

test('rapid fire changes only the temporary firing interval and expires after eight active seconds',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player;game.state.enemies=[enemy(900,0,3.3,{hp:100000,maxHp:100000})];
 game.state.drops=[bonus(game,'rapid')];game.update(.001);assert.equal(p.buffs.rapid,8);assert.equal(p.weapon.fireInterval,.68);
 advance(game,4);assert.ok(game.state.stats.shots>=10);assert.equal(p.weapon.fireInterval,.68);
 advance(game,4.1);assert.equal(p.buffs.rapid,0);const shots=game.state.stats.shots;
 for(let i=0;i<60&&game.state.stats.shots===shots;i++)game.update(1/60);
 assert.equal(game.state.stats.shots,shots+1);assert.ok(p.cooldown>.65&&p.cooldown<=.68);assert.equal(p.weapon.fireInterval,.68);
});

test('shield blocks contact and enemy projectiles for six active seconds, then damage resumes',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player;p.hp=80;p.cooldown=999;
 game.state.drops=[bonus(game,'shield')];game.update(.001);assert.equal(p.buffs.shield,6);
 game.state.enemies=[enemy(900,p.x,p.z)];game.state.projectiles=[{id:999,team:'enemy',x:p.x,z:p.z+1,vx:0,vz:-50,life:.5,radius:.15,damage:20}];
 advance(game,.1);assert.equal(p.hp,80);assert.equal(game.state.projectiles.length,0);
 advance(game,5.8);assert.equal(p.hp,80);advance(game,.2);assert.equal(p.buffs.shield,0);assert.equal(p.hp,71);
});

test('bonus timers and uncollected bonus lifetimes freeze during both upgrade choice and pause',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player;
 game.state.drops=[bonus(game,'haste',{id:90000}),bonus(game,'rapid',{id:90001}),bonus(game,'shield',{id:90002}),bonus(game,'heal',{id:90003,x:8,z:0}),{id:90004,type:'xp',x:p.x,z:p.z,value:9}];
 game.update(.001);assert.equal(game.state.phase,'upgrade');const buffs={...p.buffs},waiting=game.state.drops.find(d=>d.type==='heal'),life=waiting.life;
 advance(game,5);assert.deepEqual(p.buffs,buffs);assert.equal(waiting.life,life);
 game.chooseUpgrade(game.state.choices[0].id);advance(game,1);const after={...p.buffs},remaining=waiting.life;
 assert.ok(after.haste<buffs.haste);assert.ok(remaining<life);game.pause();advance(game,12);assert.deepEqual(p.buffs,after);assert.equal(waiting.life,remaining);
 game.resume();advance(game,.1);assert.ok(p.buffs.haste<after.haste);
});

test('magnet collects every XP gem exactly once, leaves other bonuses and pauses for level-up correctly',()=>{
 const game=run({obstacles:[]});isolate(game);const p=game.state.player;
 game.state.drops=[{id:90000,type:'xp',x:-9,z:-10,value:5},bonus(game,'magnet',{id:90001}),{id:90002,type:'xp',x:9,z:-10,value:6},bonus(game,'heal',{id:90003,x:8,z:-8})];
 game.update(.001);assert.equal(game.state.phase,'upgrade');assert.equal(game.state.level,2);assert.equal(game.state.xp,2);assert.equal(game.state.drops.length,1);assert.equal(game.state.drops[0].type,'heal');
 const events=game.drainEvents();assert.equal(events.filter(e=>e.type==='pickup'&&e.dropType==='xp').length,2);assert.ok(events.some(e=>e.type==='bonus'&&e.bonus==='magnet'&&e.amount===11));
 game.chooseUpgrade(game.state.choices[0].id);advance(game,.1);assert.equal(game.state.xp,2);assert.equal(game.state.level,2);assert.equal(game.state.drops.length,1);
});

test('uncollected bonuses expire after twenty seconds while XP remains available',()=>{
 const game=run({obstacles:[]});isolate(game);game.state.drops=[bonus(game,'rapid',{x:8,z:-8}),{id:90001,type:'xp',x:-8,z:-8,value:3,radius:.16}];
 advance(game,19.9);assert.equal(game.state.drops.length,2);advance(game,.2);assert.equal(game.state.drops.length,1);assert.equal(game.state.drops[0].type,'xp');
});
