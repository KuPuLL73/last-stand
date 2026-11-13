import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun} from '../survival-core.js';
import {BONUS_DROPS,ENDLESS_BOSSES,ENDLESS_BOSS_ORDER,endlessPressure} from '../endless-director.js';

const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const advance=(r,t,input={})=>{for(let left=t;left>1e-8;){const dt=Math.min(.25,left);r.update(dt,input);left-=dt;}};
function seeded(seed=171){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function isolated(options={}){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',obstacles:[],rng:()=>.5,...options});r.start();
 r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];r.state.warnings=[];r._spawnClock=99999;
 const p=r.state.player;p.x=p.z=0;p.cooldown=99999;r.drainEvents();return r;
}
function bossRun(id){
 const r=isolated();r.state.bossSequence=ENDLESS_BOSS_ORDER.indexOf(id);r.state.elapsed=180+r.state.bossSequence*120;
 const e=r._spawnBoss();e.x=0;e.z=4;e.speed=0;e.attackCooldown=e.volleyCooldown=e.summonCooldown=999;
 r.drainEvents();return{r,e,p:r.state.player};
}
function killOrdinary(r){const e=r._spawnEnemy('walker',6,6,null);r._damageEnemy(e,e.hp,'test');r.state.enemies=[];return e;}

test('opening pressure gives a short learning window then grows steadily within finite late-game caps',()=>{
 const times=[0,15,30,45,90,180,300,600,900,1800,3600,1e9],values=times.map(t=>endlessPressure(t));
 assert.equal(values[0].hp,1);assert.equal(values[0].maxAlive,8);assert.equal(values[0].spawnInterval,2.4);assert.equal(values[0].extraSpawnChance,0);
 assert.ok(endlessPressure(30).spawnInterval<2.4&&endlessPressure(30).spawnInterval>1);
 for(let i=1;i<values.length;i++){
  assert.ok(values[i].hp>=values[i-1].hp);assert.ok(values[i].damage>=values[i-1].damage);assert.ok(values[i].speed>=values[i-1].speed);
  assert.ok(values[i].spawnInterval<=values[i-1].spawnInterval);assert.ok(values[i].maxAlive>=values[i-1].maxAlive);
 }
 const capped=values.at(-1);assert.equal(capped.hp,5);assert.equal(capped.damage,1.8);assert.equal(capped.speed,1.26);assert.equal(capped.spawnInterval,.42);assert.equal(capped.maxAlive,60);
 const cleared=endlessPressure(1e9,1e9);assert.ok(cleared.hp<8&&cleared.damage<=2.3&&cleared.tier<=6);
 assert.deepEqual(endlessPressure(-1),endlessPressure(0));assert.deepEqual(endlessPressure(NaN),endlessPressure(0));
});

test('boost drops cannot streak through a burst and remain limited to three active finds',()=>{
 assert.deepEqual(BONUS_DROPS,{chance:.06,cooldown:8,maxActive:3});
 const r=isolated({rng:()=>0});
 for(let i=0;i<100;i++)killOrdinary(r);
 assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,1);
 assert.equal(r.state.drops.filter(d=>d.type==='xp').reduce((n,d)=>n+d.value,0),300,'XP remains guaranteed despite the boost cooldown');
 r.state.elapsed=7.99;killOrdinary(r);assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,1);
 r.state.elapsed=8;killOrdinary(r);r.state.elapsed=16;killOrdinary(r);r.state.elapsed=24;killOrdinary(r);
 assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,3);
 r.state.drops.find(d=>d.type!=='xp').life=0;r.state.elapsed=32;killOrdinary(r);
 assert.equal(r.state.drops.filter(d=>d.type!=='xp'&&d.life>0).length,3,'expired finds no longer occupy the cap');
 r.restart();r.start();r.state.enemies=[];r.state.drops=[];killOrdinary(r);assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,1,'a new run resets the drop cooldown');
});

test('drop cooldown counts active time and wounded healing bias remains useful',()=>{
 const r=isolated({rng:()=>0}),p=r.state.player;p.hp=20;killOrdinary(r);
 assert.equal(r.state.drops.find(d=>d.type!=='xp').type,'heal');
 r.pause();advance(r,30);assert.equal(r.state.elapsed,0);r.resume();advance(r,7.9);killOrdinary(r);
 assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,1);
 advance(r,.1);killOrdinary(r);assert.equal(r.state.drops.filter(d=>d.type!=='xp').length,2);
});

test('cubic solo starts with the golem and rotates six real boss archetypes at the fixed deadlines without a queue',()=>{
 const r=isolated();r.state.player.invulnerable=99999;
 const ids=[];
 for(const [i,time]of [180,300,420,540,660,780,900].entries()){
  advance(r,time-r.state.elapsed);const e=r.state.enemies.find(e=>e.id===r.state.bossId);
  assert.ok(e);ids.push(e.bossVariant);assert.equal(e.bossName,ENDLESS_BOSSES[e.bossVariant].name);
  assert.equal(r._spawnBoss().id,e.id,'duplicate calls must not create another active boss');
  assert.equal(r.state.enemies.filter(e=>e.type==='boss'&&e.hp>0).length,1);
  assert.equal(r.state.nextBossAt,time+120);r._damageEnemy(e,e.hp,'test');r.state.drops=[];
  assert.equal(r.state.phase,'playing');assert.equal(r.state.stats.bosses,i+1);
 }
 assert.deepEqual(ids,['iron-golem','wither','warden','elder-guardian','zombie-brute','ender-dragon','iron-golem']);
 const q=isolated();q.state.player.invulnerable=99999;advance(q,301);assert.equal(q.state.bossSequence,1);assert.equal(q.state.enemies.filter(e=>e.type==='boss').length,1);assert.equal(q.state.nextBossAt,420);
});

test('campaign and frontier bosses keep their original behavior and identity',()=>{
 for(const options of [{mode:'campaign',map:'cubic'},{mode:'endless',map:'frontier'},{mode:'campaign',map:'frontier'}]){
  const r=isolated(options),boss=r._spawnBoss();assert.equal(boss.bossVariant,undefined);assert.equal(r.state.bossSequence,0);
  boss.speed=0;boss.attackCooldown=0;boss.volleyCooldown=999;r.update(.01);
  assert.equal(r.state.warnings.length,1);assert.equal(r.state.warnings[0].damage,28);assert.equal(r.state.warnings[0].duration,1.3);
 }
});

test('warden sonic line warns before impact, freezes its cast on pause, and allows a clean dodge',()=>{
 const {r,e,p}=bossRun('warden');e.attackCooldown=0;r.update(.01);
 const w=r.state.warnings[0];assert.equal(w.hazard,'sonic');assert.equal(w.shape,'line');assert.ok(w.remaining>=1.5);assert.ok(e.castUntil>r.state.elapsed);
 r.pause();const saved=structuredClone(r.state);advance(r,20);assert.deepEqual(r.state,saved);r.resume();
 const hp=p.hp;advance(r,.6,{x:1});assert.equal(p.hp,hp);advance(r,1.1,{x:1});assert.equal(p.hp,hp);
 assert.equal(r.state.warnings.length,0);assert.ok(r.drainEvents().some(e=>e.type==='slam'&&e.hazard==='sonic'));
});

test('elder guardian tracks then locks a marked beam and slows only after its full warning',()=>{
 const {r,e,p}=bossRun('elder-guardian');e.attackCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.hazard,'guardian');assert.equal(warning.effect,'slow');assert.equal(warning.beam,true);assert.equal(warning.fromZ,4);assert.ok(warning.duration>=1.8);
 const hp=p.hp;advance(r,2.2);assert.equal(p.hp,hp);advance(r,.3);assert.ok(p.debuffs.slow>0);assert.equal(p.hp,hp-18);
 const q=bossRun('elder-guardian');q.e.attackCooldown=0;q.r.update(.01);advance(q.r,1.2);assert.equal(q.r.state.warnings[0].locked,true);q.p.x=7;advance(q.r,1.3);assert.equal(q.p.hp,q.p.maxHp);assert.equal(q.p.debuffs.slow,0);
});

test('wither uses a bounded skull fan and a separately telegraphed blast',()=>{
 const {r,e,p}=bossRun('wither');e.attackCooldown=0;r.update(.01);
 assert.equal(r.state.projectiles.length,0);assert.equal(e.bossSchedule.length,1);advance(r,.95);
 assert.equal(r.state.projectiles.length,3);assert.ok(r.state.projectiles.every(shot=>shot.kind==='wither-skull'&&shot.damage===11&&shot.height===2.3&&shot.y===2.3));
 advance(r,1);assert.equal(p.hp,p.maxHp-11,'overlapping fan skulls respect hit immunity');
 r.state.projectiles=[];p.invulnerable=0;e.attackCooldown=999;e.volleyCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.hazard,'wither');assert.equal(warning.duration,1.65);assert.equal(r.state.warnings.length,2);
 const hp=p.hp;p.x=7;advance(r,2);assert.equal(p.hp,hp);
});

test('warden rings keep a safe inner region and cannot stack a second cast on top',()=>{
 const {r,e,p}=bossRun('warden');e.attackCooldown=999;e.volleyCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.hazard,'sonic');assert.equal(warning.shape,'ring');assert.equal(warning.duration,1.55);
 e.attackCooldown=0;advance(r,1);assert.equal(r.state.warnings.length,2);assert.equal(p.hp,p.maxHp);
 p.z=2.2;advance(r,1.3);assert.equal(p.hp,p.maxHp);assert.equal(r.state.warnings.filter(w=>w.bossAbility==='sonic-ring').length,0);assert.ok(r.state.warnings.length<=1,'a new cast may begin only after both rings finish');
});

test('zombie brute locks its charge direction, allows a dodge and only hits once during the rush',()=>{
 const {r,e,p}=bossRun('zombie-brute');e.volleyCooldown=0;r.update(.01);
 const warning=r.state.warnings[0];assert.equal(warning.type,'charge');assert.equal(warning.duration,1.35);assert.equal(warning.fromZ,4);assert.ok(warning.length>5);assert.equal(warning.dx,0);assert.equal(warning.dz,-1);
 advance(r,.9);assert.equal(p.hp,p.maxHp);p.x=5;advance(r,1.15);assert.equal(p.hp,p.maxHp);assert.equal(e.charge.dx,0);assert.equal(e.charge.dz,-1);
 const q=bossRun('zombie-brute');q.e.volleyCooldown=0;q.r.update(.01);advance(q.r,2.1);assert.equal(q.p.hp,q.p.maxHp-22);
 const blocked=bossRun('zombie-brute');blocked.r.obstacles=[{x:0,z:2,w:4,d:.5}];blocked.e.volleyCooldown=0;blocked.r.update(.01);advance(blocked.r,1.5);
 assert.equal(blocked.p.hp,blocked.p.maxHp);assert.ok(blocked.e.z>=3.29);assert.equal(blocked.e.charge.remaining,0);
});

test('later boss cycles add bounded themed support instead of scaling HP forever',()=>{
 const r=isolated();r.state.elapsed=180+120*ENDLESS_BOSS_ORDER.length;r.state.bossSequence=ENDLESS_BOSS_ORDER.length;r.state.stats.bosses=ENDLESS_BOSS_ORDER.length;const boss=r._spawnBoss();
 assert.equal(boss.bossVariant,'iron-golem');assert.equal(boss.cycle,2);boss.x=0;boss.z=-5;boss.age=8;boss.attackCooldown=boss.volleyCooldown=999;boss.speed=0;
 r.update(.01);const children=r.state.enemies.filter(e=>e.parentBossId===boss.id);assert.equal(children.length,1);assert.equal(children[0].variant,'armored-zombie');
 r.update(.01);assert.equal(r.state.enemies.filter(e=>e.parentBossId===boss.id).length,1,'support enters once per encounter');
 const q=isolated();q.state.elapsed=1e6;q.state.bossSequence=99;q.state.stats.bosses=1e6;const late=q._spawnBoss();assert.ok(late.hp<3500);late.age=8;late.x=0;late.z=-5;
 q.state.player.invulnerable=99999;q.update(.01);assert.ok(q.state.enemies.filter(e=>e.parentBossId===late.id).length<=3);assert.ok(q.state.enemies.length<=60);
});

test('killing any telegraph source cancels its danger immediately and effects cannot bypass a shield',()=>{
 for(const id of ENDLESS_BOSS_ORDER){
  const {r,e,p}=bossRun(id);e.attackCooldown=id==='wither'?999:0;e.volleyCooldown=id==='wither'?0:999;r.update(.01);
  assert.ok(r.state.warnings.length>=1&&r.state.warnings.length<=3);r._damageEnemy(e,e.hp,'test');r.drainEvents();const hp=p.hp;r.update(.01);
  assert.equal(r.state.warnings.length,0);advance(r,2);assert.equal(p.hp,hp);assert.ok(!r.drainEvents().some(e=>e.type==='slam'));
 }
 for(const id of ['elder-guardian','warden','wither','zombie-brute']){
  const {r,e,p}=bossRun(id);p.buffs.shield=6;e.attackCooldown=id==='wither'?999:0;e.volleyCooldown=id==='wither'?0:999;r.update(.01);advance(r,1.7);
  assert.equal(p.hp,p.maxHp);assert.deepEqual(p.debuffs,{slow:0,poison:0});
 }
});

test('late elite skeleton fires heavier arrows at a slower cadence than ordinary skeletons',()=>{
 const r=isolated();r.state.elapsed=420;r.state.stats.bosses=3;const elite=r._spawnEnemy('spitter',0,5,'armored-skeleton');elite.speed=0;elite.attackCooldown=0;r.update(.01);
 assert.ok(elite.attackCooldown>=3);assert.ok(r.state.projectiles.some(shot=>shot.sourceId===elite.id&&shot.damage===14));
 const plain=r._spawnEnemy('spitter',5,0,null);r._enemyShot(plain,-1,0,4.5);assert.equal(r.state.projectiles.find(shot=>shot.sourceId===plain.id).damage,10);
});

test('ten-minute evolving cubic horde has bounded counts, ranged pressure, drops and both late elites',()=>{
 const r=isolated({rng:seeded(519)});r._spawnClock=0;r.state.player.invulnerable=99999;
 const seen=new Set();let peak=0;
 for(let i=0;i<4000&&r.state.elapsed<600;i++){
  if(r.state.phase==='upgrade'){r.chooseUpgrade(r.state.choices[0].id);continue;}
  r.update(.25);const s=r.state;
  for(const e of s.enemies){if(e.variant)seen.add(e.variant);assert.ok(e.hp<5000&&e.speed<=3&&e.damage<=35);}
  peak=Math.max(peak,s.enemies.length);assert.ok(s.enemies.length<=60);assert.ok(s.enemies.filter(e=>e.type==='spitter'&&e.hp>0).length<=6);
  assert.ok(s.projectiles.filter(shot=>shot.team==='enemy').length<=80);assert.ok(s.warnings.filter(w=>w.type==='slam').length<=3);assert.ok(s.drops.filter(d=>d.type!=='xp'&&d.life>0).length<=3);
  // Simulate steady successful defense, keeping actual spawn selection/cadence
  // while clearing a few enemies so late unlocks can enter a full horde.
  if(i%20===0){for(const e of s.enemies.filter(e=>e.type!=='boss').slice(0,4))r._damageEnemy(e,e.hp,'test');}
  const boss=s.enemies.find(e=>e.id===s.bossId&&e.age>15);if(boss)r._damageEnemy(boss,boss.hp,'test');
  r.drainEvents();
 }
 assert.ok(r.state.elapsed>=600);assert.ok(peak>=20,`peak=${peak}`);assert.ok(seen.has('armored-zombie'));assert.ok(seen.has('armored-skeleton'));assert.equal(r.state.phase,'playing');
});
