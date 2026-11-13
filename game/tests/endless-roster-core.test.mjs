import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun} from '../survival-core.js';
import {CUBIC_VARIANTS,chooseCubicVariant} from '../cubic-variants.js';
import {endlessXpNeeded} from '../endless-director.js';

const advance=(r,t,input={})=>{for(let left=t;left>1e-8;){const dt=Math.min(.25,left);r.update(dt,input);left-=dt;}};
function seeded(seed=519){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function isolated(options={}){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',obstacles:[],rng:seeded(),...options});r.start();
 const s=r.state;s.enemies=[];s.projectiles=[];s.drops=[];s.warnings=[];s.nextBossAt=1e9;r._spawnClock=99999;s.player.x=s.player.z=0;s.player.cooldown=99999;r.drainEvents();return r;
}
function spawn(r,id,x=0,z=4){const d=CUBIC_VARIANTS[id];r.state.stats.bosses=d.minBosses;r.state.elapsed=180+(d.minBosses-1)*120;return r._spawnEnemy(d.type,x,z,id);}

test('every hostile registry variant has a reachable natural gate, while future species cannot appear early',()=>{
 assert.equal(Object.keys(CUBIC_VARIANTS).length,32);
 for(const [id,d]of Object.entries(CUBIC_VARIANTS)){
  assert.ok(d.minBosses<=12);assert.ok(['walker','runner','spitter'].includes(d.type));
  const r=isolated();r.state.elapsed=1e6;r.state.stats.bosses=d.minBosses-1;assert.equal(r._spawnEnemy(d.type,5,5,id).variant,undefined,id);
  r.state.stats.bosses=d.minBosses;assert.equal(r._spawnEnemy(d.type,5,5,id).variant,id);
  const reachable=Array.from({length:600},(_,i)=>chooseCubicVariant(d.type,d.minBosses,i/1000));assert.ok(reachable.includes(id),id+' never enters a natural pool');
 }
 const active=['husk','drowned','armored-zombie','slime','magma-cube','cave-spider','stray','armored-skeleton'];
 for(const type of ['walker','runner','spitter'])for(let i=0;i<600;i++){
  const selected=chooseCubicVariant(type,12,i/1000,active);assert.ok(selected===null||active.includes(selected));
 }
});

test('ordinary natural spawning reaches the full roster across a long active session',()=>{
 const r=isolated();r._spawnClock=0;r.state.nextBossAt=180;r.state.player.invulnerable=99999;const seen=new Set();
 for(let i=0;i<1860*4;i++){
  r.update(.25);
  for(const e of r.state.enemies){if(e.variant){seen.add(e.variant);assert.ok(r.state.stats.bosses>=CUBIC_VARIANTS[e.variant].minBosses);}}
  // Remove entities only, preserving the real spawn cadence, type selection,
  // elapsed time and RNG. Every gate has a chance to enter the natural pool.
  const boss=r.state.enemies.find(e=>e.id===r.state.bossId);if(boss)r._damageEnemy(boss,boss.hp,'test');
  r.state.enemies=[];r.state.projectiles=[];r.state.warnings=[];r.state.drops=[];r.drainEvents();
 }
 assert.deepEqual([...seen].sort(),Object.keys(CUBIC_VARIANTS).sort());
});

test('slime and magma cube split into smaller descendants at most twice without breaking the live cap',()=>{
 for(const id of ['slime','magma-cube']){
  const r=isolated(),parent=spawn(r,id,5,5);r._damageEnemy(parent,parent.hp,'test');
  assert.equal(r.state.enemies.length,2);assert.ok(r.state.enemies.every(e=>e.variant===id&&e.splitGeneration===1&&Math.abs(e.modelScale-parent.modelScale*.62)<1e-9&&e.harmlessUntil>r.state.elapsed&&e.xp===0&&e.rewardEligible===false));
  for(const child of [...r.state.enemies])r._damageEnemy(child,child.hp,'test');
  assert.equal(r.state.enemies.length,4);assert.ok(r.state.enemies.every(e=>e.splitGeneration===2&&Math.abs(e.modelScale-parent.modelScale*.62**2)<1e-9));
  for(const child of [...r.state.enemies])r._damageEnemy(child,child.hp,'test');
  assert.equal(r.state.enemies.filter(e=>e.hp>0).length,0);assert.equal(r.state.kills,1,'one family cannot inflate currency kills');
  assert.equal(r.state.drops.filter(d=>d.type==='xp').reduce((n,d)=>n+d.value,0),CUBIC_VARIANTS[id].xp);
  assert.equal(r.state.drops.filter(d=>d.type==='xp').length,1,'fragments do not each drop another gem');
  const q=isolated(),large=spawn(q,id,5,5);for(let i=0;i<59;i++)q._spawnEnemy('walker',5,-5,null);q._damageEnemy(large,large.hp,'test');
  assert.equal(q.state.enemies.length,60);assert.equal(q.state.enemies.filter(e=>e.splitGeneration===1).length,1);
 }
});

test('poison archers, witches and wind projectiles use real hit effects and bounded volleys',()=>{
 for(const id of ['bogged','witch']){
  const r=isolated(),e=spawn(r,id);e.speed=0;e.attackCooldown=0;r.update(.01);
  const shot=r.state.projectiles[0];assert.equal(shot.effect,'poison');assert.equal(shot.kind,id==='bogged'?'arrow':'potion');
  advance(r,1);assert.ok(r.state.player.debuffs.poison>0);
 }
 const wind=isolated(),breeze=spawn(wind,'breeze');breeze.speed=0;breeze.attackCooldown=0;wind.update(.01);advance(wind,1);
 assert.ok(wind.state.player.z<-.8,'a landed wind charge displaces the player, rather than only changing its colour');
 const fire=isolated(),blaze=spawn(fire,'blaze');blaze.speed=0;blaze.attackCooldown=0;fire.update(.01);
 assert.equal(fire.state.projectiles.length,3);assert.ok(fire.state.projectiles.every(p=>p.kind==='fireball'&&p.damage===7&&p.y>1));
});

test('enderman teleports away after a hit with recovery and a cooldown rather than onto the player',()=>{
 const r=isolated(),e=spawn(r,'enderman');e.teleportCooldown=0;const before={x:e.x,z:e.z};r._damageEnemy(e,1,'test');
 assert.ok(Math.hypot(e.x-before.x,e.z-before.z)>=2);assert.ok(Math.hypot(e.x,e.z)>=4);assert.equal(e.teleportCooldown,7);assert.ok(e.stun>0&&e.harmlessUntil>r.state.elapsed);
 for(let i=0;i<10;i++)r._damageEnemy(e,1,'test');assert.equal(r.drainEvents().filter(e=>e.type==='teleport').length,1);
});

test('evoker fangs warn first, guardian beams snapshot the target, and summoned vex remain capped',()=>{
 const r=isolated(),e=spawn(r,'evoker',0,5);e.speed=0;e.attackCooldown=e.summonCooldown=0;r.state.player.invulnerable=99999;r.update(.01);
 assert.equal(r.state.warnings[0].hazard,'fangs');assert.ok(r.state.warnings[0].duration>=1.2);assert.equal(r.state.enemies.filter(child=>child.parentCasterId===e.id).length,2);
 advance(r,30);assert.ok(r.state.enemies.filter(child=>child.parentCasterId===e.id).length<=3);
 const q=isolated(),guardian=spawn(q,'guardian');guardian.speed=0;guardian.attackCooldown=0;q.update(.01);
 const warning=q.state.warnings[0];assert.ok(warning.beam);assert.equal(warning.hazard,'guardian');const hp=q.state.player.hp;q.state.player.x=7;advance(q,1.7);assert.equal(q.state.player.hp,hp);
});

test('flying enemies can cross low cover while ground enemies remain blocked',()=>{
 const r=isolated({obstacles:[{x:0,z:2,w:4,d:1}]}),flying=spawn(r,'phantom',0,4),ground=r._spawnEnemy('walker',0,4,null);
 flying.speed=ground.speed=2;advance(r,1.1);assert.ok(flying.z<2);assert.ok(ground.z>=2.49);
});

test('solo choices are rarer only through XP costs, with no artificial timer or lost banked experience',()=>{
 const r=isolated(),s=r.state;s.xp=9;r._checkLevel();assert.equal(s.phase,'upgrade');assert.equal(s.level,2);assert.equal(s.xp,0);assert.ok(!('nextUpgradeAt' in s));
 r.chooseUpgrade(s.choices[0].id);s.xp=s.xpNeeded-1;r._checkLevel();assert.equal(s.phase,'playing');const xp=s.xp;r.pause();advance(r,100);r.resume();assert.equal(s.xp,xp);r._checkLevel();assert.equal(s.phase,'playing','waiting alone must never grant an upgrade');
 s.xp++;r._checkLevel();assert.equal(s.phase,'upgrade');assert.equal(s.level,3);assert.equal(s.elapsed,0,'earned XP can be used immediately without a cooldown');
 r.chooseUpgrade(s.choices[0].id);s.xp=s.xpNeeded+7;const cost=s.xpNeeded;r._checkLevel();assert.equal(s.level,4);assert.equal(s.xp,7);assert.ok(cost>15);
 r.restart();assert.equal(r.state.xp,0);assert.ok(!('nextUpgradeAt' in r.state));
});

test('solo XP costs rise faster after early levels while campaign retains the original curve',()=>{
 assert.equal(endlessXpNeeded(1),9);assert.ok(endlessXpNeeded(10)>9+9*5.5);assert.ok(endlessXpNeeded(20)>endlessXpNeeded(10)*2);
 const r=isolated({mode:'campaign'});r.state.xp=100;r._checkLevel();assert.equal(r.state.xpNeeded,15);r.chooseUpgrade(r.state.choices[0].id);assert.equal(r.state.phase,'upgrade');assert.ok(!('nextUpgradeAt' in r.state));
});
