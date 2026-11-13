import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun} from '../survival-core.js';
function arena(weapon){const r=new SurvivalRun({weapon,character:'steve',map:'cubic',mode:'endless',obstacles:[],rng:()=>.5});r.start();r.state.enemies=[];r.state.player.x=r.state.player.z=0;r._spawnClock=9999;return r;}
const advance=(r,time)=>{for(let t=0;t<time;t+=.01)r.update(Math.min(.01,time-t));};
test('snowballs refresh one real movement slow, freeze it on pause and cannot permanently lock a boss',()=>{
 const r=arena('snow-caster'),e=r._spawnEnemy('walker',0,4,null);e.attackCooldown=999;advance(r,.22);assert.ok(e.slowTime>0);assert.equal(e.slowStrength,.28);
 r.state.player.cooldown=999;r.state.projectiles=[];const frozen=structuredClone(r.state);r.pause();r.update(.2);assert.deepEqual(r.state,{...frozen,phase:'paused'});r.resume();advance(r,1.5);assert.equal(e.slowTime,0);
 const q=arena('snow-caster'),boss=q._spawnBoss();q._slowEnemy(boss,1.25,.28);assert.ok(Math.abs(boss.slowStrength-.098)<1e-9);assert.equal(boss.slowTime,1.25);
});
test('a thrown trident hits two aligned targets and loses damage after penetration',()=>{
 const r=arena('tide-trident'),es=[2,4,6].map(z=>{const e=r._spawnEnemy('walker',0,z,null);e.hp=e.maxHp=100;e.speed=0;return e;});advance(r,.4);
 assert.equal(es[0].hp,54);assert.ok(Math.abs(es[1].hp-67.8)<1e-9);assert.equal(es[2].hp,100);assert.equal(r.state.stats.shots,1);
});
test('ranged bow skill improves tempo proportionally without erasing slow reloads or weakening a max-speed build',()=>{
 for(const weapon of ['hunting-bow','crossbow','ember-staff','snow-caster','tide-trident'])for(const rank of [0,5]){
  const r=arena(weapon),p=r.state.player;
  for(let i=0;i<rank;i++){r.state.phase='upgrade';r.state.choices=[{id:'rate'}];r.chooseUpgrade('rate');}
  p.buffs.rapid=rank?99:0;
  const normal=Math.max(.22,p.weapon.fireInterval*(rank?.6:1));
  r._shootArrow({x:0,z:5});
  assert.ok(Math.abs(p.cooldown-Math.max(.18,normal*.7))<1e-9);assert.equal(r.state.projectiles[0].damage,p.weapon.damage);
  if(weapon==='crossbow'&&!rank)assert.ok(p.cooldown>1.2,'the skill must preserve a meaningful crossbow reload');
 }
});
test('the axe role gains a wider useful sweep while the crossbow pays for its safe reach with cadence',()=>{
 const axe=arena('stone-axe'),a=axe.state.player.weapon,crossbow=arena('crossbow').state.player.weapon;
 assert.equal(a.damage,44);assert.ok(a.arc>=115*Math.PI/180-1e-9);assert.ok(a.knockback<=.9);
 assert.equal(crossbow.damage,48);assert.equal(crossbow.pierce,1);assert.ok(crossbow.fireInterval>=1.8);assert.ok(crossbow.range<=10.8);
});
