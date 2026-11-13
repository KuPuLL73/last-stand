import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun} from '../survival-core.js';
import {ENDLESS_BOSS_ORDER} from '../endless-director.js';

function encounter(id){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',obstacles:[],rng:()=>.5});r.start();
 r.state.enemies=[];r.state.projectiles=[];r.state.warnings=[];r.state.drops=[];r._spawnClock=99999;
 r.state.bossSequence=ENDLESS_BOSS_ORDER.indexOf(id);r.state.elapsed=180+r.state.bossSequence*120;r.state.nextBossAt=r.state.elapsed+99999;
 const e=r._spawnBoss();e.x=0;e.z=4;e.speed=0;e.attackCooldown=e.volleyCooldown=e.summonCooldown=999;
 const p=r.state.player;p.x=p.z=0;p.cooldown=99999;r.drainEvents();return{r,e,p};
}
function advance(r,seconds,input={}){for(let left=seconds;left>1e-8;){const dt=Math.min(.05,left);r.update(dt,input);left-=dt;}}

test('golem stone wave marks three fixed sequential impacts and leaves lateral escape routes',()=>{
 const {r,e,p}=encounter('iron-golem');e.z=6;e.volleyCooldown=0;r.update(.01);
 const warnings=r.state.warnings;assert.equal(warnings.length,3);
 assert.ok(warnings.every(w=>w.bossAbility==='stone-wave'&&w.hazard==='stone'));
 assert.ok(warnings[0].remaining<warnings[1].remaining&&warnings[1].remaining<warnings[2].remaining);
 assert.equal(new Set(warnings.map(w=>w.z)).size,3);
 const targets=warnings.map(w=>[w.x,w.z]);p.x=6;advance(r,.5);assert.deepEqual(warnings.map(w=>[w.x,w.z]),targets);
 advance(r,1.7);assert.equal(p.hp,p.maxHp);assert.equal(r.state.warnings.length,0);
});

test('wither visibly winds up a locked skull fan, freezes on pause and enters a distinct second phase',()=>{
 const {r,e,p}=encounter('wither');e.attackCooldown=0;r.update(.01);
 assert.equal(r.state.projectiles.length,0);assert.equal(e.bossSchedule.length,1);
 assert.ok(r.drainEvents().some(event=>event.type==='bossability'&&event.ability==='skull-volley'&&event.stage==='windup'));
 r.pause();const paused=structuredClone(r.state);advance(r,20);assert.deepEqual(r.state,paused);r.resume();
 p.x=7;advance(r,.95);
 assert.equal(r.state.projectiles.length,3);assert.ok(r.state.projectiles.every(shot=>shot.kind==='wither-skull'&&shot.vz<0&&shot.damage===11));
 assert.ok(Math.abs(r.state.projectiles[1].vx)<1e-6,'the central skull keeps the telegraphed aim');
 assert.equal(p.hp,p.maxHp);
 r.state.projectiles=[];e.hp=e.maxHp*.49;e.attackCooldown=0;r.update(.01);advance(r,.95);
 assert.equal(e.bossPhase,2);assert.equal(r.state.projectiles.length,5);
 const phases=r.drainEvents().filter(event=>event.type==='bossability'&&event.stage==='phase');assert.equal(phases.length,1);
});

test('guardian tracks first, locks a full beam path, and gives an independent final dodge window',()=>{
 const {r,e,p}=encounter('elder-guardian');e.attackCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.shape,'line');assert.equal(warning.beam,true);assert.equal(warning.fromZ,4);
 p.x=3;advance(r,.6);assert.equal(warning.x,3);assert.equal(warning.locked,undefined);
 p.x=5;advance(r,.6);assert.equal(warning.locked,true);assert.equal(warning.x,5);
 p.x=9;advance(r,1.3);assert.equal(warning.x,5);assert.equal(p.hp,p.maxHp);assert.equal(p.debuffs.slow,0);
 assert.ok(r.drainEvents().some(event=>event.type==='bossability'&&event.ability==='guardian-beam'&&event.stage==='lock'));
 const q=encounter('elder-guardian');q.e.attackCooldown=0;q.r.update(.01);advance(q.r,2.45);
 assert.equal(q.p.hp,q.p.maxHp-18);assert.ok(q.p.debuffs.slow>0);
});

test('warden sonic beam damages its whole line but permits a sideways dodge',()=>{
 const {r,e,p}=encounter('warden');e.attackCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.shape,'line');assert.equal(warning.bossAbility,'sonic-boom');assert.equal(warning.duration,1.6);
 const hp=p.hp;p.z=-3;advance(r,1.65);assert.equal(p.hp,hp-23,'standing on the ray away from its endpoint is dangerous');
 const q=encounter('warden');q.e.attackCooldown=0;q.r.update(.01);q.p.x=4;advance(q.r,1.65);assert.equal(q.p.hp,q.p.maxHp);
});

test('warden expanding annuli keep their inner safe space and do not silently hit the whole disk',()=>{
 const {r,e,p}=encounter('warden');e.volleyCooldown=0;r.update(.01);
 assert.equal(r.state.warnings.length,2);assert.ok(r.state.warnings.every(w=>w.shape==='ring'&&w.innerRadius>0));
 p.z=2.2;advance(r,2.3);assert.equal(p.hp,p.maxHp,'inside the ring remains safe without touching the boss');
 const q=encounter('warden');q.e.volleyCooldown=0;q.r.update(.01);advance(q.r,1.6);assert.equal(q.p.hp,q.p.maxHp-19);
});

test('brute direction stays locked during a rush and landing has its own avoidable smash warning',()=>{
 const {r,e,p}=encounter('zombie-brute');e.volleyCooldown=0;r.update(.01);
 const charge=r.state.warnings[0];assert.equal(charge.type,'charge');assert.equal(charge.bossAbility,'brute-charge');assert.equal(charge.dx,0);assert.equal(charge.dz,-1);
 p.x=5;advance(r,2.1);assert.equal(p.hp,p.maxHp);assert.equal(e.charge.dx,0);assert.equal(e.charge.dz,-1);
 const landing=r.state.warnings.find(w=>w.bossAbility==='brute-landing');assert.ok(landing);assert.ok(landing.remaining>.8);
 advance(r,1.3);assert.equal(p.hp,p.maxHp);
});

test('dragon flyby crosses cover while its ground lane is warned, and breath leaves bounded active zones',()=>{
 const {r,e,p}=encounter('ender-dragon');e.z=6;r.obstacles=[{x:0,z:3,w:6,d:1}];e.volleyCooldown=0;r.update(.01);
 assert.equal(r.state.warnings[0].bossAbility,'dragon-flyby');p.x=6;advance(r,2.65);
 assert.ok(e.z<1,'a flying dragon does not stop on ground cover');assert.equal(p.hp,p.maxHp);
 const q=encounter('ender-dragon');q.e.attackCooldown=0;q.r.update(.01);
 assert.equal(q.r.state.warnings.length,3);assert.ok(q.r.state.warnings.every(w=>w.bossAbility==='dragon-breath'&&w.zoneDuration===3));
 q.p.x=8;advance(q.r,2.15);assert.equal(q.r.state.warnings.length,3);assert.ok(q.r.state.warnings.every(w=>w.type==='zone'&&w.active));
 q.r.pause();const paused=structuredClone(q.r.state);advance(q.r,10);assert.deepEqual(q.r.state,paused);q.r.resume();
 q.r._damageEnemy(q.e,q.e.hp,'test');q.r.update(.05);assert.equal(q.r.state.warnings.length,0);assert.equal(q.p.hp,q.p.maxHp);
});

test('new abilities preserve telegraph/projectile budgets and a dead source cannot release queued skulls',()=>{
 const {r,e}=encounter('wither');
 for(let i=0;i<80;i++)r._enemyShot(e,0,-1,1);
 e.attackCooldown=0;r.update(.01);r.state.elapsed+=1;r._bossTickAbilities(e);assert.equal(r.state.projectiles.filter(p=>p.team==='enemy').length,80);
 r.state.projectiles=[];e.attackCooldown=0;e.castUntil=0;r.update(.01);assert.equal(e.bossSchedule.length,1);r._damageEnemy(e,e.hp,'test');advance(r,1.1);assert.equal(r.state.projectiles.length,0);
 const q=encounter('iron-golem');q.e.volleyCooldown=0;q.r.update(.01);assert.equal(q.r.state.warnings.length,3);
 q.e.volleyCooldown=0;q.e.castUntil=0;q.r.update(.01);assert.ok(q.r.state.warnings.length<=3);
});

test('dragon breath hurts after its warning, pulses only in its marked area and stops hurting after escape',()=>{
 const {r,e,p}=encounter('ender-dragon');e.attackCooldown=0;r.update(.01);
 advance(r,1.55);assert.equal(p.hp,p.maxHp,'no breath damage before the marked impact');
 advance(r,.4);assert.equal(p.hp,p.maxHp-12);
 advance(r,.8);assert.equal(p.hp,p.maxHp-19,'lingering breath has a separate bounded seven-damage pulse');
 p.x=8;const hp=p.hp;advance(r,1);assert.equal(p.hp,hp,'leaving the cloud avoids subsequent pulses');
});
