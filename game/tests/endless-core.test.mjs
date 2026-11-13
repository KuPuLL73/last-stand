import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';
import {policy,chooseUpgrade} from '../tools/combat-balance-samples.mjs';

const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function seeded(seed=171){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function advance(r,seconds,input={}){for(let remaining=seconds;remaining>1e-8;){const dt=Math.min(.25,remaining);r.update(dt,input);remaining-=dt;}}
function isolated(options={}){
 const r=new SurvivalRun({mode:'endless',obstacles:[],rng:seeded(),...options});r.start();
 r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];r._spawnClock=99999;
 r.state.player.cooldown=99999;r.state.player.invulnerable=99999;r.drainEvents();return r;
}
function boss(r){return r.state.enemies.find(e=>e.id===r.state.bossId&&e.hp>0);}
function killBoss(r){const target=boss(r);assert.ok(target);r._damageEnemy(target,target.hp,'test');return target;}

test('campaign remains the default four-minute win condition and invalid modes cannot select endless',()=>{
 for(const options of [{},{mode:'unsupported'}]){
  const r=new SurvivalRun(options);assert.equal(r.mode,'campaign');assert.equal(r.state.mode,'campaign');assert.equal(r.state.remaining,240);assert.equal(r.state.nextBossAt,240);
  assert.equal(r.setMode('invalid'),false);assert.equal(r.state.mode,'campaign');
 }
 const r=isolated({mode:'campaign',duration:.25});advance(r,.3);assert.ok(boss(r));killBoss(r);
 assert.equal(r.state.phase,'won');assert.equal(r.state.stats.bosses,1);assert.ok(r.drainEvents().some(e=>e.type==='win'));
});

test('mode changes only before a run and survives character choice, retirement and restart',()=>{
 const r=new SurvivalRun({character:'steve',map:'cubic'});assert.equal(r.setMode('endless'),true);
 assert.equal(r.state.mode,'endless');assert.equal(r.state.remaining,180);assert.equal(r.setCharacter('shelly'),true);assert.equal(r.state.mode,'endless');
 r.start();assert.equal(r.setMode('campaign'),false);r.pause();assert.equal(r.setMode('campaign'),false);assert.equal(r.retire(),true);assert.equal(r.setMode('campaign'),false);
 r.restart();assert.equal(r.state.mode,'endless');assert.equal(r.state.character,'shelly');assert.equal(r.state.map,'cubic');assert.equal(r.state.stats.bosses,0);assert.equal(r.state.nextBossAt,180);
 assert.equal(r.setMode('campaign'),true);assert.equal(r.state.remaining,240);
});

test('endless spawns bosses at 180, 300 and 420 active seconds and every kill continues the run',()=>{
 const r=isolated();advance(r,179.75);assert.equal(r.state.bossId,null);close(r.state.remaining,.25);
 for(const at of [180,300,420]){
  advance(r,at-r.state.elapsed);assert.ok(boss(r));assert.equal(r.state.nextBossAt,at+120);close(r.state.remaining,120);
  const target=killBoss(r);assert.equal(r.state.phase,'playing');assert.equal(r.state.bossId,null);assert.equal(r.state.stats.bosses,(at-180)/120+1);
  assert.ok(r.state.drops.some(d=>d.type==='xp'&&d.value===target.xp));
  const events=r.drainEvents();assert.ok(events.some(e=>e.type==='bossdefeated'&&e.nextBossAt===at+120));assert.ok(!events.some(e=>e.type==='win'));
  advance(r,.1);assert.equal(r.state.bossId,null,'killing a boss must not immediately respawn it');
 }
 assert.ok(r.state.wave>=15);assert.equal(r.state.kills,3);
});

test('an undefeated boss skips later deadlines without duplicate bosses or an overdue queue',()=>{
 const r=isolated();advance(r,180);const firstId=r.state.bossId;advance(r,121);
 assert.equal(r.state.bossId,firstId);assert.equal(r.state.enemies.filter(e=>e.type==='boss'&&e.hp>0).length,1);assert.equal(r.state.nextBossAt,420);
 killBoss(r);r.state.drops=[];advance(r,118.75);assert.equal(r.state.bossId,null);close(r.state.remaining,.25);
 advance(r,.25);assert.ok(boss(r));assert.notEqual(r.state.bossId,firstId);assert.equal(r.state.nextBossAt,540);
});

test('pause and upgrade screens freeze the endless boss clock and resume its pending deadline',()=>{
 const r=isolated();advance(r,179.5);r.pause();const saved=structuredClone(r.state);advance(r,25);assert.deepEqual(r.state,saved);r.resume();
 r.state.phase='upgrade';r.state.choices=[getUpgradeDefs(r.state.character)[0]];advance(r,25);close(r.state.elapsed,179.5);close(r.state.remaining,.5);assert.equal(r.state.bossId,null);
 assert.equal(r.chooseUpgrade(r.state.choices[0].id),true);advance(r,.5);assert.ok(boss(r));assert.equal(r.state.nextBossAt,300);
});

test('retiring playing, paused or upgrading runs freezes state and emits one result without a win',()=>{
 for(const phase of ['playing','paused','upgrade']){
  const r=isolated({character:'steve'});r.state.player.cooldown=0;r._super();advance(r,.2);
  r.state.player.pendingAttack={remaining:.1};r.state.choices=[getUpgradeDefs('steve')[0]];
  if(phase==='paused')r.pause();else r.state.phase=phase;
  assert.equal(r.retire(),true);assert.equal(r.state.phase,'retired');assert.equal(r.state.player.bowTime,0);assert.equal(r.state.player.pendingAttack,null);assert.deepEqual(r.state.choices,[]);
  const frozen=structuredClone(r.state);advance(r,30,{x:1,super:true});assert.deepEqual(r.state,frozen);assert.equal(r.resume(),false);assert.equal(r.start(),false);assert.equal(r.retire(),false);
  const events=r.drainEvents();assert.equal(events.filter(e=>e.type==='runend').length,1);assert.ok(!events.some(e=>e.type==='win'));
  assert.equal(events.find(e=>e.type==='runend').reason,'retired');assert.equal(events.find(e=>e.type==='runend').mode,'endless');
  r.restart();assert.equal(r.state.phase,'ready');assert.equal(r.state.mode,'endless');assert.equal(r.state.player.bowTime,0);assert.equal(r.state.nextBossAt,180);
 }
 const ready=new SurvivalRun({mode:'endless'});assert.equal(ready.retire(),false);
 const dead=isolated();dead.state.player.invulnerable=0;dead._hurtPlayer(99999,0,0,'test');assert.equal(dead.retire(),false);assert.equal(dead.state.phase,'dead');
});

test('endless enemies and later bosses become tougher with finite bounded statistics',()=>{
 const r=isolated();
 r.state.elapsed=180;const early=r._spawnEnemy('walker',5,5);const first=r._spawnEnemy('boss',5,5);
 r.state.elapsed=600;r.state.stats.bosses=3;const later=r._spawnEnemy('walker',5,5),laterBoss=r._spawnEnemy('boss',5,5);
 assert.ok(later.hp>early.hp);assert.ok(later.speed>=early.speed);assert.ok(later.damage>early.damage);assert.ok(laterBoss.hp>first.hp);
 r.state.elapsed=1e9;r.state.level=1e6;r.state.stats.bosses=1e6;
 for(const type of ['walker','runner','spitter','creeper','boss']){
  const e=r._spawnEnemy(type,5,5);assert.ok(Number.isFinite(e.hp)&&e.hp>0&&e.hp<5000,JSON.stringify(e));assert.ok(e.speed<=3);assert.ok(e.damage<=35);
 }
});

test('natural endless spawning remains at most sixty live enemies after the first boss arrives',()=>{
 const r=new SurvivalRun({mode:'endless',rng:seeded(77),obstacles:[]});r.start();r.state.player.invulnerable=99999;r.state.player.cooldown=99999;
 let peak=0,bossSeen=false;
 for(let seconds=0;seconds<330;seconds+=.25){
  r.update(.25);peak=Math.max(peak,r.state.enemies.length);bossSeen||=r.state.bossId!==null;
  assert.ok(r.state.enemies.length<=60);assert.equal(r.state.phase,'playing');
  assert.ok(r.state.projectiles.length<=100);assert.ok(r.state.warnings.length<=10);
  r.drainEvents();
 }
 assert.ok(bossSeen);assert.equal(peak,60);assert.equal(r.state.nextBossAt,420);assert.equal(r.state.stats.bosses,0);
});

test('starter Steve can survive two boss deadlines with earned upgrades while a long first fight skips the second spawn',()=>{
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',rng:seeded(171)});r.start();
 const memory={};let peak=0,nextDecision=0,input={};assert.equal(r.state.player.hp,125);
 for(let i=0;i<60*340&&r.state.elapsed<305-1e-8&&r.state.phase!=='dead';i++){
  if(r.state.phase==='upgrade'){chooseUpgrade(r);continue;}
  if(r.state.elapsed>=nextDecision){input=policy(r,memory,{bossFocus:true});nextDecision=r.state.elapsed+.1;}
  r.update(Math.min(1/30,305-r.state.elapsed),input);peak=Math.max(peak,r.state.enemies.length);r.drainEvents();
 }
 const evidence={phase:r.state.phase,time:r.state.elapsed,hp:r.state.player.hp,kills:r.state.kills,level:r.state.level,bosses:r.state.stats.bosses,peak};
 assert.equal(r.state.phase,'playing',JSON.stringify(evidence));assert.ok(r.state.elapsed>=305,JSON.stringify(evidence));assert.ok(r.state.player.hp>0,JSON.stringify(evidence));assert.ok(r.state.level>=7,JSON.stringify(evidence));assert.ok(r.state.stats.superUses>1);assert.ok(peak<=60);assert.equal(r.state.nextBossAt,420);
 // Tougher enemies and the new two-attack golem no longer promise that one
 // observation-only starter policy wins before 300s. A surviving active boss
 // must be wounded, unique, and skip that deadline rather than queue another.
 const boss=r.state.enemies.find(e=>e.id===r.state.bossId&&e.hp>0);
 assert.ok(r.state.stats.bosses>=1||(boss&&boss.hp<boss.maxHp),JSON.stringify(evidence));
 assert.ok(r.state.enemies.filter(e=>e.type==='boss'&&e.hp>0).length<=1);
});
