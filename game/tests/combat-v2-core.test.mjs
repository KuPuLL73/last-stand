import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';
import {STEVE_WEAPONS} from '../steve-weapons.js';
const advance=(r,seconds,input={})=>{for(let t=0;t<seconds-1e-9;t+=.05)r.update(Math.min(.05,seconds-t),input);};
function arena(options={}){
 const r=new SurvivalRun({map:'cubic',mode:'endless',character:'steve',obstacles:[],rng:()=>.5,...options});r.start();
 const s=r.state;s.enemies=[];s.drops=[];s.projectiles=[];s.warnings=[];s.nextBossAt=1e9;r._spawnClock=99999;s.player.x=s.player.z=0;return r;
}
function target(r,x=0,z=5){const e=r._spawnEnemy('walker',x,z,null);e.speed=0;e.attackCooldown=999;return e;}
function offer(r,id){r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('steve',r.weaponId).find(u=>u.id===id)];r.chooseUpgrade(id);}

test('three safe ordinary enemies precede a gradual opening, with no early special enemy dump',()=>{
 const r=new SurvivalRun({map:'cubic',mode:'endless',character:'steve',obstacles:[],rng:()=>.9});r.start();
 assert.equal(r.state.enemies.length,3);assert.ok(r.state.enemies.every(e=>e.type==='walker'&&!e.variant));
 r.state.player.cooldown=99999;advance(r,2.5);assert.equal(r.state.enemies.length,3);
 advance(r,12);assert.ok(r.state.enemies.length>3&&r.state.enemies.length<=10);assert.ok(r.state.enemies.every(e=>e.type==='walker'));
});

test('starter enemies take multiple wooden hits and later ranks increase durability without reading player damage',()=>{
 const r=arena(),a=target(r);assert.equal(Math.ceil(a.hp/r.state.player.weapon.damage),3);
 r.state.elapsed=600;r.state.stats.bosses=3;const b=target(r,6,6);
 assert.ok(b.hp>a.hp*3);assert.ok(b.damage>a.damage);assert.ok(b.rank>a.rank);assert.ok(b.modelScale>a.modelScale);
 const q=arena({weapon:'netherite-axe'});q.state.elapsed=600;q.state.stats.bosses=3;assert.equal(target(q).maxHp,b.maxHp,'buying damage must not secretly rescale enemies');
});

test('a living enemy visibly evolves at the rank boundary and keeps its damage fraction',()=>{
 const r=arena(),e=target(r);r.state.player.cooldown=99999;e.hp=e.maxHp*.5;r.state.elapsed=119.99;r.update(.02);
 assert.equal(e.rank,2);assert.ok(e.maxHp>54);assert.ok(Math.abs(e.hp/e.maxHp-.5)<1e-9);
 const saved=structuredClone(r.state);r.pause();advance(r,20);assert.deepEqual(r.state,{...saved,phase:'paused'});
});

test('all five ranged weapons auto-fire their distinct real projectile rather than a melee swing',()=>{
 for(const definition of STEVE_WEAPONS.filter(w=>w.attackMode==='ranged')){
  const r=arena({weapon:definition.id}),e=target(r);r.update(.01);
  assert.equal(r.state.player.pendingAttack,null);assert.equal(r.state.projectiles[0].kind,definition.rangedKind);
  assert.equal(r.state.projectiles[0].damage,definition.damage);assert.ok(r.drainEvents().some(e=>e.type==='rangedshot'));
  advance(r,.4);assert.ok(e.hp<e.maxHp,definition.id+' must really hit the distant target');
 }
});

test('a crossbow bolt penetrates two targets with falling damage and cover still blocks ranged damage',()=>{
 const r=arena({weapon:'crossbow'}),es=[target(r,0,2),target(r,0,4),target(r,0,6)];
 for(const e of es)e.hp=e.maxHp=100;
 advance(r,.4);assert.equal(es[0].hp,52);assert.ok(Math.abs(es[1].hp-65.44)<1e-9);assert.equal(es[2].hp,100);assert.equal(r.state.stats.shots,1);
 const q=arena({weapon:'crossbow',obstacles:[{x:0,z:3,w:3,d:.5}]}),covered=target(q,0,5);advance(q,1);assert.equal(covered.hp,covered.maxHp);
});

test('staff impact burns and splashes nearby enemies without duplicating its direct damage',()=>{
 const r=arena({weapon:'ember-staff'}),a=target(r,0,4),b=target(r,1,4),outside=target(r,3,4);
 advance(r,.4);assert.ok(a.hp<a.maxHp-24&&a.burn>0);assert.ok(b.hp<b.maxHp&&b.burn>0);assert.equal(outside.hp,outside.maxHp);
 assert.equal(r.drainEvents().filter(e=>e.type==='emberblast').length,1);
});

test('bow skill strengthens ranged shooting and preserves earned multishot, splash and piercing',()=>{
 for(const weapon of ['hunting-bow','crossbow','ember-staff']){
  const r=arena({weapon});offer(r,'pellets');const e=target(r);e.hp=e.maxHp=10000;
  const w=r.state.player.weapon,normalDps=w.damage/w.fireInterval;
  r.update(.01,{super:true});const shots=r.state.projectiles;
  assert.equal(shots.length,2);assert.ok(shots[0].damage/r.state.player.cooldown>=normalDps);
  assert.equal(shots[0].pierce,w.pierce);assert.equal(shots[0].splashRadius,w.splashRadius);
 }
});

test('dash follows movement, hits each enemy once, respects solid cover and freezes on pause',()=>{
 const r=arena({skill:'dash'}),e=target(r,2,0);r.state.player.cooldown=9999;
 r.update(.05,{x:1,super:true});const saved=structuredClone(r.state);r.pause();advance(r,2);assert.deepEqual(r.state,{...saved,phase:'paused'});r.resume();advance(r,.4);
 assert.ok(r.state.player.x>4.5);assert.ok(Math.abs(e.maxHp-e.hp-33.6)<1e-9);assert.equal(r.state.stats.superUses,1);
 const q=arena({skill:'dash',obstacles:[{x:3,z:0,w:.6,d:4}]});q.update(.05,{x:1,super:true});advance(q,.4);assert.ok(q.state.player.x<=2.28);
});

test('bulwark reflects a real incoming projectile back into its source and cannot recharge itself while active',()=>{
 const r=arena({skill:'bulwark'}),e=r._spawnEnemy('spitter',0,4,null);e.speed=0;e.attackCooldown=999;r.state.player.cooldown=999;
 r.update(.01,{super:true});r._enemyShot(e,0,-1,5,{damage:10,kind:'arrow'});advance(r,1);
 assert.equal(r.state.player.hp,r.state.player.maxHp);assert.ok(e.hp<e.maxHp);assert.equal(r.state.player.super,0);
 assert.ok(r.drainEvents().some(e=>e.type==='reflect'));assert.equal(r.setSkill('dash'),false);
});
