import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun} from '../survival-core.js';
import {CUBIC_VARIANTS,CUBIC_DEBUFFS,chooseCubicVariant} from '../cubic-variants.js';

const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function advance(r,seconds,input={}){for(let remaining=seconds;remaining>1e-8;){const dt=Math.min(.25,remaining);r.update(dt,input);remaining-=dt;}}
function seeded(seed=171){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function isolated(options={}){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',obstacles:[],rng:seeded(),...options});r.start();
 r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];r._spawnClock=99999;r.state.nextBossAt=1e9;r.drainEvents();
 r.state.player.x=r.state.player.z=0;r.state.player.cooldown=99999;return r;
}
function spawn(r,variant,x=0,z=4){const d=CUBIC_VARIANTS[variant];r.state.stats.bosses=d.minBosses;r.state.elapsed=180+(d.minBosses-1)*120;return r._spawnEnemy(d.type,x,z,variant);}

test('cubic variants unlock after boss victories, never from elapsed time alone',()=>{
 const expected={husk:1,drowned:1,stray:2,'cave-spider':2,'armored-zombie':3,'armored-skeleton':3};
 for(const [id,cleared] of Object.entries(expected)){
  const d=CUBIC_VARIANTS[id];assert.equal(d.minBosses,cleared);const r=isolated();r.state.elapsed=1e6;r.state.stats.bosses=cleared-1;
  assert.equal(r._spawnEnemy(d.type,5,5,id).variant,undefined,`${id} unlocked before its required victory`);
  r.state.stats.bosses=cleared;assert.equal(r._spawnEnemy(d.type,5,5,id).variant,id);
  assert.equal(chooseCubicVariant(d.type,cleared,.99),null,'normal creatures must remain available');
 }
 for(const type of ['walker','runner','spitter','creeper','boss'])assert.equal(chooseCubicVariant(type,0,0),null);
 assert.equal(chooseCubicVariant('walker',1,0),'husk');assert.equal(chooseCubicVariant('walker',1,.2),'drowned');assert.equal(chooseCubicVariant('spitter',2,0),'stray');assert.equal(chooseCubicVariant('runner',2,0),'cave-spider');
 for(const type of ['creeper','boss'])assert.equal(chooseCubicVariant(type,500,0),null);
});

test('natural spawning introduces families after real boss kills and leaves campaign/frontier unchanged',()=>{
 const r=isolated(),seen=new Set(),base=new Set();r.state.nextBossAt=180;r.state.player.invulnerable=99999;r._spawnClock=0;
 for(let i=0;i<2156;i++){
  r.update(.25);
  for(const e of r.state.enemies){if(e.variant){assert.ok(r.state.stats.bosses>=CUBIC_VARIANTS[e.variant].minBosses);seen.add(e.variant);}else base.add(e.type);}
  if(r.state.elapsed<180)assert.equal(seen.size,0);
  const boss=r.state.enemies.find(e=>e.id===r.state.bossId);if(boss)r._damageEnemy(boss,boss.hp,'test');
  r.state.enemies=[];r.state.projectiles=[];r.state.warnings=[];r.state.drops=[];r.drainEvents();
 }
 assert.equal(r.state.stats.bosses,3);assert.deepEqual([...seen].sort(),Object.entries(CUBIC_VARIANTS).filter(([,d])=>d.minBosses<=3).map(([id])=>id).sort());
 assert.ok(base.has('walker')&&base.has('runner')&&base.has('spitter'));
 for(const options of [{map:'cubic',mode:'campaign'},{map:'frontier',mode:'endless'}]){
  const q=isolated(options);q.state.elapsed=1e6;q.state.stats.bosses=12;for(let i=0;i<100;i++)assert.equal(q._spawnEnemy(['walker','runner','spitter'][i%3],5,5).variant,undefined);
 }
});

test('variants have distinct stats, matching base behavior and finite late-game limits',()=>{
 for(const [id,d] of Object.entries(CUBIC_VARIANTS)){
  const r=isolated(),e=spawn(r,id),base=r._spawnEnemy(d.type,4,4,null);
  assert.equal(e.type,d.type);assert.equal(e.xp,d.xp);close(e.hp,base.hp*d.hp);close(e.speed,Math.min(3,base.speed*d.speed));close(e.damage,base.damage*d.damage);close(e.radius,base.radius*d.radius);
  r.state.elapsed=1e9;r.state.level=1e6;r.state.stats.bosses=1e6;
  const late=r._spawnEnemy(d.type,5,5,id);assert.ok(Number.isFinite(late.hp)&&late.hp>0&&late.hp<5000);assert.ok(late.speed>0&&late.speed<=3);assert.ok(late.damage>0&&late.damage<=35);
 }
 const r=isolated();r.state.elapsed=180;assert.equal(r._spawnEnemy('runner',3,3,'husk').variant,undefined,'wrong family must not receive the skin or stats');
});

test('stray arrows apply one timed slow only after a real unblocked hit',()=>{
 const r=isolated(),p=r.state.player,e=spawn(r,'stray',0,4);e.speed=0;e.attackCooldown=0;
 r.update(.01);const arrow=r.state.projectiles.find(b=>b.team==='enemy');assert.ok(arrow);assert.equal(arrow.kind,'arrow');assert.equal(arrow.effect,'slow');
 e.attackCooldown=999;advance(r,1);assert.ok(p.debuffs.slow>0);assert.equal(p.hp,p.maxHp-10);assert.ok(r.drainEvents().some(e=>e.type==='debuff'&&e.debuff==='slow'&&e.duration===2.5));
 r.state.enemies=[];const x=p.x;advance(r,.5,{x:1});close(p.x-x,p.speed*.8*.5);
 p.debuffs.slow=0;r._applyDebuff('slow',e.id);r._applyDebuff('slow',e.id);assert.equal(p.debuffs.slow,2.5);
 advance(r,2.6);assert.equal(p.debuffs.slow,0);p.x=0;advance(r,.5,{x:1});close(p.x,p.speed*.5);

 for(const protectedBy of ['shield','invulnerable']){
  const q=isolated(),target=q.state.player,shooter=spawn(q,'stray',0,1);
  shooter.speed=0;shooter.attackCooldown=999;
  if(protectedBy==='shield')target.buffs.shield=6;else target.invulnerable=6;
  q._enemyShot(shooter,0,-1,4.5);advance(q,.3);assert.equal(target.debuffs.slow,0);assert.equal(target.hp,target.maxHp);
 }
 const q=isolated({obstacles:[{x:0,z:2,w:3,d:.3}]}),shooter=spawn(q,'stray',0,4);shooter.speed=0;shooter.attackCooldown=999;q._enemyShot(shooter,0,-1,4.5);advance(q,1);
 assert.equal(q.state.player.debuffs.slow,0);assert.equal(q.state.player.hp,q.state.player.maxHp);
});

test('cave spider contact poisons for six health over three active seconds without stacking or lethal damage',()=>{
 const r=isolated(),p=r.state.player,e=spawn(r,'cave-spider',0,.5);e.speed=0;
 r.update(.001);assert.equal(p.debuffs.poison,3);close(p.hp,p.maxHp-e.damage);
 r.state.enemies=[];const hp=p.hp;advance(r,3.5);close(hp-p.hp,6);assert.equal(p.debuffs.poison,0);
 p.hp=3;r._applyDebuff('poison',e.id);r._applyDebuff('poison',e.id);assert.equal(p.debuffs.poison,3);advance(r,3.2);assert.equal(p.hp,1);assert.equal(r.state.phase,'playing');
 p.invulnerable=0;r._hurtPlayer(1,0,0,'contact');assert.equal(r.state.phase,'dead','direct attacks still defeat a poisoned player');
});

test('poison expiry prorates the final fractional step and is independent of frame chunking',()=>{
 const r=isolated(),p=r.state.player;p.hp=50;p.debuffs.poison=.019;
 r.update(.25);close(p.hp,50-.019*CUBIC_DEBUFFS.poison.damagePerSecond);assert.equal(p.debuffs.poison,0);
 const expired=p.hp;advance(r,1);assert.equal(p.hp,expired,'an expired status must never subtract another frame');
 for(const frame of [1/120,.07,.25]){
  const q=isolated(),target=q.state.player;target.hp=50;q._applyDebuff('poison',1);
  for(let remaining=3.4;remaining>1e-8;){const dt=Math.min(frame,remaining);q.update(dt);remaining-=dt;}
  close(target.hp,44);assert.equal(target.debuffs.poison,0);
 }
});

test('debuff clocks freeze for pause and upgrade choice, shield pickup cleanses both immediately',()=>{
 const r=isolated(),p=r.state.player;
 r._applyDebuff('slow',90);r._applyDebuff('poison',91);r.pause();const frozen=structuredClone(r.state);advance(r,30);assert.deepEqual(r.state,frozen);r.resume();
 r.state.phase='upgrade';r.state.choices=[];advance(r,30);assert.equal(p.debuffs.slow,2.5);assert.equal(p.debuffs.poison,3);r.state.phase='playing';
 r._collectDrop({id:999,type:'shield',x:0,z:0});assert.deepEqual(p.debuffs,{slow:0,poison:0});assert.equal(p.buffs.shield,6);
 assert.equal(r._applyDebuff('poison',1),false);assert.equal(r._applyDebuff('slow',1),false);
 r.restart();assert.deepEqual(r.state.player.debuffs,{slow:0,poison:0});
});

test('natural later-wave cubic hordes retain enemy, projectile and damage caps',()=>{
 const r=isolated({rng:seeded(77)});r.state.elapsed=1500;r.state.stats.bosses=12;r._spawnClock=0;r.state.player.invulnerable=99999;let peak=0;const seen=new Set();
 for(let i=0;i<60*6*4;i++){
  r.update(.25);peak=Math.max(peak,r.state.enemies.length);
  assert.equal(r.state.phase,'playing');assert.ok(r.state.enemies.length<=60);assert.ok(r.state.projectiles.length<=100);assert.ok(r.state.warnings.length<=10);
  for(const e of r.state.enemies){assert.ok(e.speed<=3);assert.ok(e.damage<=35);if(e.variant)seen.add(e.variant);}
  r.drainEvents();
 }
 assert.equal(peak,60);assert.ok(seen.size>=2);
});
