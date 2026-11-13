import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';
import {STEVE_WEAPONS,STEVE_START_WEAPON,weaponStats} from '../steve-weapons.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const advance=(r,t)=>{for(let left=t;left>1e-8;){const dt=Math.min(.1,left);r.update(dt);left-=dt;}};
function offer(r,id){r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('steve').find(d=>d.id===id)];assert.equal(r.chooseUpgrade(id),true);}
function arena(weapon=STEVE_START_WEAPON){
 const r=new SurvivalRun({character:'steve',weapon,obstacles:[],rng:()=>.9});r.start();r._spawnClock=99999;
 r.state.enemies=[];r.state.drops=[];r.state.projectiles=[];r.state.player.x=r.state.player.z=0;return r;
}

test('Steve starts with the wooden sword, validates equipment and preserves its selection between runs',()=>{
 const r=new SurvivalRun({character:'steve'});assert.equal(r.weaponId,'wooden-sword');assert.equal(r.state.player.weapon.id,'wooden-sword');assert.equal(r.state.player.weapon.damage,24);assert.equal(r.state.player.weapon.fireInterval,.8);
 assert.equal(r.setWeapon('invalid'),false);assert.equal(r.setWeapon('diamond-axe'),true);assert.equal(r.state.player.weapon.type,'axe');assert.equal(r.state.player.weapon.damage,70);
 r.start();assert.equal(r.setWeapon('diamond-sword'),false);r.pause();assert.equal(r.setWeapon('iron-sword'),false);r.restart();assert.equal(r.state.player.weapon.id,'diamond-axe');
 r.setCharacter('shelly');assert.equal(r.state.player.weapon.type,'shotgun');r.setCharacter('steve');assert.equal(r.state.player.weapon.id,'diamond-axe');
 const fallback=new SurvivalRun({character:'steve',weapon:'missing'});assert.equal(fallback.weaponId,'wooden-sword');
});

test('all seventeen equipment choices use their real melee/ranged parameters and trident base piercing',()=>{
 assert.equal(STEVE_WEAPONS.length,17);assert.equal(STEVE_WEAPONS.filter(w=>w.attackMode==='ranged').length,5);
 for(const definition of STEVE_WEAPONS){
  const r=new SurvivalRun({character:'steve',weapon:definition.id});
  for(const [key,value]of Object.entries(weaponStats(definition.id)))assert.equal(r.state.player.weapon[key],value,definition.id+'/'+key);
 }
 const r=arena('trident');assert.equal(r.state.player.weapon.pierce,1);offer(r,'pierce');assert.equal(r.state.player.weapon.pierce,2);offer(r,'damage');assert.ok(r.state.player.weapon.damage>42);
 r.restart();assert.equal(r.state.player.weapon.id,'trident');assert.equal(r.state.player.weapon.pierce,1);assert.equal(r.state.player.weapon.damage,42);
});

test('the starting arrow cannot kill a full-health ordinary zombie and fires at the reduced base cadence',()=>{
 const r=arena(),p=r.state.player,e=r._spawnEnemy('walker',0,5,null);e.speed=0;e.attackCooldown=999;r.update(.001,{super:true});
 assert.equal(r.state.projectiles.length,1);close(r.state.projectiles[0].damage,14.4);close(p.cooldown,.8);advance(r,.3);
 assert.ok(e.hp>0);close(e.hp,e.maxHp-14.4);assert.equal(r.state.stats.shots,1);
 advance(r,.51);assert.equal(r.state.stats.shots,2);assert.equal(p.bowTime<8,true);
});

test('bow timing is independent of melee speed and never exceeds the .4-second floor with rate and rapid upgrades',()=>{
 for(const id of ['golden-sword','mace']){
  const r=arena(id),p=r.state.player;for(let i=0;i<5;i++)offer(r,'rate');p.buffs.rapid=99;
  const e=r._spawnEnemy('walker',0,6,null);e.hp=e.maxHp=1e6;e.speed=0;e.attackCooldown=999;
  r.update(.001,{super:true});close(p.cooldown,.4);assert.equal(r.state.projectiles[0].damage,p.weapon.damage*.60);advance(r,7.95);
  assert.ok(r.state.stats.shots>=19&&r.state.stats.shots<=20,`${id}: ${r.state.stats.shots} arrows in eight active seconds`);
  assert.ok(p.bowTime>0);advance(r,.1);assert.equal(p.bowTime,0);
 }
});

test('collecting or refreshing rapid fire during bow mode cannot borrow the faster melee cooldown',()=>{
 for(const id of ['golden-sword','mace']){
  const r=arena(id),p=r.state.player;for(let i=0;i<5;i++)offer(r,'rate');
  const e=r._spawnEnemy('walker',0,6,null);e.hp=e.maxHp=1e6;e.speed=0;e.attackCooldown=999;
  const shots=[];let pickups=0;
  const collect=()=>r.state.drops.push({id:99900+pickups++,type:'rapid',x:p.x,z:p.z,life:20,value:0,radius:.3});
  // First pickup lands in the very step that releases the first arrow.
  collect();r.update(.001,{super:true});for(const event of r.drainEvents())if(event.type==='bowshot')shots.push(r.state.elapsed);
  for(let i=0;i<240;i++){
   // Refresh soon after a later shot as well as in the middle of its cycle.
   if(i===25||i===61)collect();
   r.update(1/120);for(const event of r.drainEvents())if(event.type==='bowshot')shots.push(r.state.elapsed);
  }
  assert.equal(r.state.stats.bonuses,3);assert.ok(p.bowTime>0);assert.ok(shots.length>=5);
  for(let i=1;i<shots.length;i++)assert.ok(shots[i]-shots[i-1]>=.4-1e-6,`${id}: arrows at ${shots.join(', ')}`);
 }
});
