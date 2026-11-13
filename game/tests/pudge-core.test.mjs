import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';

const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function run(options={}){
 const r=new SurvivalRun({character:'pudge',obstacles:[],rng:()=>.5,...options});r.start();r.state.enemies=[];r.state.drops=[];r.state.projectiles=[];r._spawnClock=9999;r.drainEvents();r.state.player.x=0;r.state.player.z=0;r.state.player.cooldown=999;return r;
}
function advance(r,seconds,input={}){for(let remaining=seconds;remaining>1e-8;){const dt=Math.min(1/60,remaining);r.update(dt,input);remaining-=dt;}}
function enemy(r,x,z,options={}){const e=r._spawnEnemy(options.type||'walker',x,z);e.hp=e.maxHp=options.hp??500;e.speed=options.speed??0;e.attackCooldown=e.volleyCooldown=999;return e;}
function offer(r,id){const def=getUpgradeDefs(r.state.character).find(u=>u.id===id);r.state.phase='upgrade';r.state.choices=[{...def,rank:r.state.upgrades[id]+1}];assert.equal(r.chooseUpgrade(id),true);}
function levelUp(r){r.state.drops.push({id:90000+r.state.level,type:'xp',x:r.state.player.x,z:r.state.player.z,value:r.state.xpNeeded});r.update(.01);assert.equal(r.state.phase,'upgrade');}

test('Pudge can be selected only between runs and restarts as a heavy melee hero',()=>{
 const r=new SurvivalRun();assert.equal(r.setCharacter('pudge'),true);assert.equal(r.state.character,'pudge');assert.equal(r.state.player.weapon.type,'cleaver');assert.equal(r.state.player.hp,160);assert.equal(r.state.player.maxHp,160);assert.equal(r.state.player.speed,3.8);assert.equal(r.state.player.rot.level,0);assert.equal(r.state.upgrades.rot,0);
 r.start();assert.equal(r.setCharacter('steve'),false);r.restart();assert.equal(r.state.character,'pudge');assert.equal(r.setCharacter('shelly'),true);assert.equal('rot'in r.state.upgrades,false);assert.equal('rot'in r.state.player,false);
});

test('Rot is guaranteed as an early choice but remains locked until the player picks it',()=>{
 const r=run();levelUp(r);assert.equal(r.state.level,2);assert.equal(r.state.choices.length,3);assert.equal(new Set(r.state.choices.map(c=>c.id)).size,3);assert.ok(r.state.choices.some(c=>c.id==='rot'));assert.equal(r.state.player.rot.level,0);
 const other=r.state.choices.find(c=>c.id!=='rot').id;assert.equal(r.chooseUpgrade(other),true);assert.equal(r.state.player.rot.level,0);assert.equal(r.state.upgrades.rot,0);
 levelUp(r);assert.ok(r.state.choices.some(c=>c.id==='rot'));r.chooseUpgrade('rot');assert.deepEqual(r.state.player.rot,{level:1,radius:2.3,dps:12,slow:.2});
});

test('Rot belongs only to Pudge and has five selectable ranks',()=>{
 assert.equal(getUpgradeDefs('pudge').length,11);assert.equal(getUpgradeDefs('pudge').find(d=>d.id==='rot').max,5);
 for(const hero of ['steve','shelly'])assert.ok(!getUpgradeDefs(hero).some(d=>d.id==='rot'));
 const r=run();for(let rank=1;rank<=5;rank++){offer(r,'rot');assert.equal(r.state.player.rot.level,rank);close(r.state.player.rot.radius,2.3+(rank-1)*.2);assert.equal(r.state.player.rot.dps,12+(rank-1)*4);assert.equal(r.state.player.rot.slow,.2);}
 levelUp(r);assert.ok(!r.state.choices.some(c=>c.id==='rot'));
});

test('Rot damages every visible nearby enemy without touching distant or covered targets',()=>{
 const r=run({obstacles:[{x:-1,z:0,w:.3,d:1}]});offer(r,'rot');const a=enemy(r,0,2),b=enemy(r,1.5,1.5),outside=enemy(r,0,3.2),covered=enemy(r,-2,0);
 r.update(.01);close(a.hp,495.2);close(b.hp,495.2);assert.equal(outside.hp,500);assert.equal(covered.hp,500);assert.equal(a.rotSlow,.2);assert.equal(b.rotSlow,.2);assert.equal(outside.rotSlow,0);assert.equal(covered.rotSlow,0);
 const pulses=r.drainEvents().filter(e=>e.type==='rotpulse');assert.equal(pulses.length,1);assert.equal(pulses[0].hits,2);assert.equal(pulses[0].radius,2.3);
});

test('Rot delivers 12 damage per second over its repeat period and causes no self-damage',()=>{
 const r=run();offer(r,'rot');const e=enemy(r,0,2);r.state.player.hp=91;r.update(.01);const hp=e.hp;
 advance(r,1.2);close(hp-e.hp,14.4);assert.equal(r.state.player.hp,91);
 const events=r.drainEvents(),pulses=events.filter(e=>e.type==='rotpulse');assert.equal(pulses.length,4);assert.ok(!events.some(e=>e.type==='hurt'));
});

test('Rot slows movement only inside the cloud and never overwrites base enemy speed',()=>{
 const r=run();offer(r,'rot');const e=enemy(r,0,2,{speed:1});const baseSpeed=e.speed;r.update(.1);close(2-e.z,.08);assert.equal(e.speed,baseSpeed);assert.equal(e.rotSlow,.2);
 e.z=4;const before=e.z;r.update(.1);close(before-e.z,.1);assert.equal(e.speed,baseSpeed);assert.equal(e.rotSlow,0);
});

test('Rot damage clock freezes during pause and upgrade choice',()=>{
 const r=run();offer(r,'rot');const e=enemy(r,0,2);r.update(.1);const hp=e.hp;r.pause();advance(r,2);assert.equal(e.hp,hp);r.resume();
 r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('pudge').find(d=>d.id==='damage')];advance(r,2);assert.equal(e.hp,hp);r.chooseUpgrade('damage');advance(r,.25);assert.equal(e.hp,hp);advance(r,.07);assert.ok(e.hp<hp);
});

test('Pudge death stops Rot damage, and restarting removes learned Rot',()=>{
 const r=run();offer(r,'rot');const e=enemy(r,0,2);r.update(.01);const hp=e.hp;r._hurtPlayer(999,0,0,'test');assert.equal(r.state.phase,'dead');advance(r,1);assert.equal(e.hp,hp);
 r.restart();assert.equal(r.state.character,'pudge');assert.equal(r.state.player.rot.level,0);assert.equal(r.state.upgrades.rot,0);assert.equal(r.state.player.hp,160);
});

test('Cleaver winds up before damaging multiple enemies in front and never fires pellets',()=>{
 const r=run(),front=enemy(r,0,1.7),side=enemy(r,1.4,1.5),back=enemy(r,0,-2);r.state.player.cooldown=0;r.update(.001);const start=r.drainEvents().find(e=>e.type==='melee');assert.equal(start.character,'pudge');assert.equal(start.weapon,'cleaver');close(start.duration,.55);close(start.impactDelay,.18);
 advance(r,.15);assert.equal(front.hp,500);advance(r,.04);assert.equal(front.hp,445);assert.equal(side.hp,445);assert.equal(back.hp,500);assert.equal(r.state.projectiles.length,0);assert.ok(r.drainEvents().some(e=>e.type==='hit'&&e.cause==='cleaver'));
});

test('An empty, distant or covered hook target never consumes charge',()=>{
 for(const setup of ['empty','distant','covered']){const r=run({obstacles:setup==='covered'?[{x:0,z:2,w:2,d:.3}]:[]});if(setup!=='empty')enemy(r,0,setup==='distant'?8.5:4);r.update(.01,{super:true});assert.equal(r.state.player.super,100,setup);assert.equal(r.state.stats.superUses,0,setup);assert.equal(r.state.player.superCooldown,0,setup);assert.ok(r.drainEvents().some(e=>e.type==='abilityempty'&&e.ability==='hook'));}
});

test('Meat Hook damages and pulls a living normal enemy into cleaver range',()=>{
 const r=run(),e=enemy(r,0,6);r.update(.01,{super:true});close(e.hp,420);close(Math.hypot(e.x,e.z),1.6);assert.ok(e.stun>0);assert.equal(r.state.stats.superUses,1);assert.ok(r.state.player.superCooldown>0);assert.equal(r.state.player.super,0);
 const event=r.drainEvents().find(e=>e.type==='hook');assert.equal(event.targetId,e.id);assert.equal(event.targetX,0);assert.equal(event.targetZ,6);close(event.hitZ,1.6);assert.equal(event.boss,false);
});

test('A hooked boss takes damage without being pulled across the arena',()=>{
 const r=run(),e=enemy(r,0,6,{type:'boss',hp:2000});r.update(.01,{super:true});assert.equal(e.hp,1920);assert.equal(e.x,0);assert.equal(e.z,6);assert.ok(r.drainEvents().some(e=>e.type==='hook'&&e.boss));
});

test('Hook chooses the nearest visible enemy and respects intervening cover',()=>{
 const r=run({obstacles:[{x:-1,z:0,w:.3,d:1}]}),blocked=enemy(r,-2,0),visible=enemy(r,0,4),far=enemy(r,0,6);r.update(.01,{super:true});assert.equal(blocked.hp,500);assert.equal(visible.hp,420);assert.equal(far.hp,500);assert.equal(r.drainEvents().find(e=>e.type==='hook').targetId,visible.id);
});

test('Pudge can survive the full four-minute run using earned Rot, upgrades and pickups',()=>{
 let seed=171;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const r=new SurvivalRun({character:'pudge',rng});r.start();let bossSeen=false;
 const priority=['rot','damage','pellets','rate','ricochet','burn','regen','maxhp','pierce','speed','pickup'];
 for(let i=0;i<60*300&&!['won','dead'].includes(r.state.phase);i++){
  const s=r.state,p=s.player;
  if(s.phase==='upgrade'){
   const choices=[...s.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));
   const health=p.hp<p.maxHp*.5?choices.find(c=>c.id==='maxhp'||c.id==='regen'):null;r.chooseUpgrade((health||choices[0]).id);continue;
  }
  const drop=[...s.drops].sort((a,b)=>{
   const value=d=>(d.type==='heal'&&p.hp<p.maxHp*.7?0:d.type==='shield'?1:2);
   return value(a)-value(b)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z);
  })[0];
  let x=Math.cos(i/140),z=Math.sin(i/140);
  if(drop){const d=Math.hypot(drop.x-p.x,drop.z-p.z)||1;x=(drop.x-p.x)/d;z=(drop.z-p.z)/d;}
  let nearby=0;
  for(const e of s.enemies){const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||.1;if(d<7)nearby++;if(d<2.25){const weight=(2.25-d)*2.7;x+=dx/d*weight;z+=dz/d*weight;}}
  for(const b of s.projectiles){if(b.team!=='enemy')continue;const dx=p.x-b.x-b.vx*.15,dz=p.z-b.z-b.vz*.15,d=Math.hypot(dx,dz)||.1;if(d<1.7){x+=dx/d*(1.7-d)*3;z+=dz/d*(1.7-d)*3;}}
  for(const w of s.warnings){const dx=p.x-w.x,dz=p.z-w.z,d=Math.hypot(dx,dz)||.1;if(d<w.radius+1){x+=dx/d*5;z+=dz/d*5;}}
  if(p.x>8)x-=1.5;if(p.x<-8)x+=1.5;if(p.z>9)z-=1.5;if(p.z<-9)z+=1.5;
  r.update(1/60,{x,z,super:p.super>=100&&(nearby>=3||p.hp<80)});if(r.state.bossId!==null)bossSeen=true;r.drainEvents();
 }
 const final={phase:r.state.phase,time:r.state.elapsed,hp:r.state.player.hp,kills:r.state.kills,level:r.state.level,rot:r.state.upgrades.rot};
 assert.ok(bossSeen,JSON.stringify(final));assert.ok(r.state.elapsed>=240,JSON.stringify(final));assert.ok(r.state.level>10,JSON.stringify(final));assert.ok(r.state.upgrades.rot>0,JSON.stringify(final));assert.ok(r.state.stats.superUses>1,JSON.stringify(final));assert.equal(r.state.phase,'won',JSON.stringify(final));
});
