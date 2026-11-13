import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SurvivalRun} from '../survival-core.js';
import {getSteveWeapon} from '../steve-weapons.js';
import {MAP,movePlayer,segmentBox} from '../logic.js';

// A deterministic observation/input policy, not a test that changes player stats.
// All damage, healing, XP, upgrades, skills, spawns and deaths use the real core.
// These are the seven CUBIC_OBSTACLES in cubic-stage.js; no renderer is required.
const obstacles=[{x:-4.5,z:2.5,w:2,d:1},{x:4.5,z:1.5,w:1,d:2},{x:.5,z:-3.5,w:2,d:1},{x:-6.5,z:-5.5,w:1,d:2},{x:6.5,z:-5.5,w:2,d:1},{x:-9.5,z:3.5,w:1,d:1},{x:9.5,z:3.5,w:1,d:1}];
const seeds=[44,171,519,2026,8675309];
const weapons=['wooden-sword','hunting-bow','crossbow'];
const duration=Number(process.env.BALANCE_SECONDS)||360;
const sampledAt=[15,30,45,90,180,240,300,360].filter(t=>t<=duration);
const round=n=>Math.round(n*100)/100;
const directions=[{x:0,z:0},...Array.from({length:24},(_,i)=>({x:Math.cos(i*Math.PI/12),z:Math.sin(i*Math.PI/12)}))];
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function segmentDistance(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-dx*t,z-az-dz*t);}
function shapeDistance(point,w){
 if(w.shape==='line'||w.type==='charge')return segmentDistance(point.x,point.z,w.fromX,w.fromZ,w.x,w.z)-(w.width||1)/2;
 const d=Math.hypot(point.x-w.x,point.z-w.z);
 if(w.shape==='ring')return d<w.innerRadius?w.innerRadius-d:d>w.radius?d-w.radius:-Math.min(d-w.innerRadius,w.radius-d);
 return d-w.radius;
}
export function chooseUpgrade(r){
 const s=r.state,p=s.player,ranged=p.weapon.attackMode==='ranged';
 const priorities={damage:6,rate:5.6,pellets:ranged?5.3:4.8,pierce:ranged?4.8:3.8,ricochet:ranged?3.4:5.2,burn:s.upgrades.burn?3.9:5.8,speed:s.upgrades.speed?2.8:4.9,regen:s.upgrades.regen?2.9:5.1,maxhp:3.4,pickup:s.upgrades.pickup?2.2:3.9};
 if(p.hp<p.maxHp*.6){priorities.maxhp=10;priorities.regen=8;}
 const choice=[...s.choices].sort((a,b)=>(priorities[b.id]||0)-(priorities[a.id]||0))[0];r.chooseUpgrade(choice.id);return choice.id;
}
export function policy(r,memory,{bossFocus=false}={}){
 const s=r.state,p=s.player,enemies=s.enemies.filter(e=>e.hp>0),ranged=p.weapon.attackMode==='ranged'||p.bowTime>0;
 const near=[...enemies].sort((a,b)=>distance(p,a)-distance(p,b));
 const activeBoss=near.find(e=>e.type==='boss');
 const pursuingBoss=bossFocus&&activeBoss&&p.hp>p.maxHp*.5;
 const target=pursuingBoss?activeBoss:near.find(e=>!r.obstacles.some(box=>segmentBox(p.x,p.z,e.x,e.z,box)!==null))||near[0];
 const loot=s.drops.filter(d=>!d.collected&&(d.type==='xp'||d.life>0)).map(d=>{
  const d0=distance(p,d),danger=near.reduce((n,e)=>n+(distance(d,e)<1.65?5:0),0);
  const utility=d.type==='heal'&&p.hp<p.maxHp*.75?8:d.type==='shield'?3.5:d.type==='magnet'?2.5:d.type==='xp'?1.4:d.type==='heal'?0:1.5;
  return{drop:d,cost:d0+danger-utility};
 }).sort((a,b)=>a.cost-b.cost)[0];
 const urgentLoot=loot&&(loot.drop.type==='heal'&&p.hp<p.maxHp*.7||loot.drop.type==='shield');
 const goal=loot&&loot.cost<10&&(!pursuingBoss||urgentLoot)?loot.drop:null;
 const horizon=.42,speed=p.speed*(p.buffs.haste>0?1.35:1)*(p.debuffs.slow>0?.66:1);
 let best={x:0,z:0},lowest=Infinity;
 for(const input of directions){
  let at={x:p.x,z:p.z};
  for(let i=0;i<3;i++)at=movePlayer(at,input.x*speed*horizon/3,input.z*speed*horizon/3,p.radius,r.obstacles,r.bounds);
  let cost=0;
  const travelled=distance(at,p),wanted=Math.hypot(input.x,input.z)*speed*horizon;
  cost+=Math.max(0,wanted-travelled)*3;
  const border=Math.min(at.x-MAP.minX,MAP.maxX-at.x,at.z-MAP.minZ,MAP.maxZ-at.z);
  cost+=Math.max(0,1.7-border)*4;
  if(goal)cost+=distance(at,goal)*1.4;
  else cost+=Math.hypot(at.x-Math.cos(s.elapsed*.13)*3,at.z-Math.sin(s.elapsed*.13)*3)*.06;
  if(target){
   const effectiveRange=p.bowTime>0?p.weapon.bowRange:p.weapon.range;
   const desired=ranged?Math.min(effectiveRange*.58,6):Math.max(target.radius+p.radius+.35,effectiveRange*.78);
   const d=distance(at,target);
   cost+=Math.abs(d-desired)*(goal?.28:1.1);
   if(r.obstacles.some(box=>segmentBox(at.x,at.z,target.x,target.z,box)!==null))cost+=3;
  }
  for(const e of near){
   const d0=distance(e,p)||1,moving=!(e.castUntil>s.elapsed)&&!(e.stun>0);
   const ex=e.x+(moving?(p.x-e.x)/d0*e.speed*horizon:0),ez=e.z+(moving?(p.z-e.z)/d0*e.speed*horizon:0);
   // Score the whole continuous relative path, not just its endpoint. A
   // 0.42-second candidate must not look safe by passing through a zombie.
   const ax=p.x-e.x,az=p.z-e.z,vx=at.x-p.x-(ex-e.x),vz=at.z-p.z-(ez-e.z),t=Math.max(0,Math.min(1,-(ax*vx+az*vz)/(vx*vx+vz*vz||1)));
   const gap=Math.min(Math.hypot(at.x-ex,at.z-ez),Math.hypot(ax+vx*t,az+vz*t))-e.radius-p.radius;
   if(gap<.8)cost+=Math.pow(.8-gap,2)*38;
   if(ranged&&gap<2)cost+=(2-gap)*2.3;
  }
  for(const shot of s.projectiles){
   if(shot.team!=='enemy'||shot.life<=0)continue;
   const ax=shot.x-p.x,az=shot.z-p.z,vx=shot.vx-input.x*speed,vz=shot.vz-input.z*speed;
   const t=Math.max(0,Math.min(horizon,-(ax*vx+az*vz)/(vx*vx+vz*vz||1)));
   const clearance=Math.hypot(ax+vx*t,az+vz*t)-(shot.radius+p.radius+.18);
   if(clearance<.5)cost+=Math.pow(.5-clearance,2)*70;
  }
  for(const w of s.warnings){
   if(w.remaining<=0)continue;
   const clearance=shapeDistance(at,w)-p.radius-.22;
   const urgent=w.active||w.remaining<horizon+.6;
   if(clearance<.45)cost+=Math.pow(.45-clearance,2)*(urgent?75:12);
  }
  if(memory.last)cost+=(1-(input.x*memory.last.x+input.z*memory.last.z))*.16;
  if(cost<lowest){lowest=cost;best=input;}
 }
 memory.last=best;
 const nearest=near[0]?distance(p,near[0]):Infinity,nearby=near.filter(e=>distance(p,e)<5).length,boss=near.find(e=>e.type==='boss');
 return{...best,super:p.super>=100&&p.superCooldown<=0&&((nearest<4.2&&nearby>=3)||(boss&&distance(p,boss)<8)||(p.hp<p.maxHp*.55&&nearest<6))};
}
async function main(){
const fingerprints={};
for(const file of ['survival-core.js','endless-director.js','steve-weapons.js'])fingerprints[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
const results=[];
for(const weapon of weapons)for(const seed of seeds){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',weapon,skill:'bow',obstacles,bounds:MAP,rng:seeded(seed)});r.start();
 const snapshots=[],choices=[],memory={};let peak=0,openingPeak=0,damageTaken=0,input={},nextDecision=0;
 const absorb=()=>{for(const event of r.drainEvents())if(event.type==='hurt')damageTaken+=event.damage;};
 const snapshot=()=>({time:round(r.state.elapsed),phase:r.state.phase,hp:round(r.state.player.hp),maxHp:r.state.player.maxHp,kills:r.state.kills,alive:r.state.enemies.filter(e=>e.hp>0).length,level:r.state.level,upgrades:structuredClone(r.state.upgrades),bosses:r.state.stats.bosses,damageTaken:round(damageTaken),superUses:r.state.stats.superUses});
 absorb();
 for(let guard=0;guard<duration*60+1000&&r.state.elapsed<duration-1e-8&&r.state.phase!=='dead';guard++){
  if(r.state.phase==='upgrade'){choices.push({time:round(r.state.elapsed),id:chooseUpgrade(r)});absorb();continue;}
  if(r.state.elapsed>=nextDecision){input=policy(r,memory);nextDecision=r.state.elapsed+.1;}
  r.update(Math.min(1/30,duration-r.state.elapsed),input);absorb();
  const alive=r.state.enemies.filter(e=>e.hp>0).length;peak=Math.max(peak,alive);if(r.state.elapsed<=45)openingPeak=Math.max(openingPeak,alive);
  while(snapshots.length<sampledAt.length&&r.state.elapsed>=sampledAt[snapshots.length]-1e-8)snapshots.push(snapshot());
 }
 const final=snapshot(),result={weapon,weaponName:getSteveWeapon(weapon).name,seed,deathTime:r.state.phase==='dead'?final.time:null,peakAlive:peak,openingPeakAlive:openingPeak,chosenUpgrades:choices,snapshots,final};results.push(result);
 console.log(JSON.stringify({weapon,seed,deathTime:result.deathTime,peak,openingPeak,kills:final.kills,level:final.level,bosses:final.bosses,hp:final.hp,at45:snapshots.find(s=>s.time>=45&&s.time<46)}));
}
const summary=weapons.map(weapon=>{
 const rows=results.filter(r=>r.weapon===weapon),at45=rows.map(r=>r.snapshots.find(s=>s.time>=45&&s.time<46)).filter(Boolean),avg=values=>round(values.reduce((a,b)=>a+b,0)/Math.max(1,values.length));
 return{weapon,runs:rows.length,survived45:at45.filter(s=>s.phase!=='dead').length,survived180:rows.filter(r=>r.final.time>=180).length,survived360:rows.filter(r=>r.final.time>=360).length,averageKills45:avg(at45.map(s=>s.kills)),averageHp45:avg(at45.map(s=>s.hp)),averageLevel45:avg(at45.map(s=>s.level)),averageFinalKills:avg(rows.map(r=>r.final.kills)),averageFinalTime:avg(rows.map(r=>r.final.time)),minFinalTime:Math.min(...rows.map(r=>r.final.time)),maxBosses:Math.max(...rows.map(r=>r.final.bosses))};
});
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/combat-balance-samples.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),duration,seeds,fingerprints,policy:'Automated tactical movement, 100ms decisions, 30Hz inputs with real 60Hz core substeps; observed live state and 0.42s lookahead; ordinary health/skills/earned upgrades. No injected health, invulnerability, XP, kills, enemies or shortened boss timers. Loadout weapons are scenario selections, not economic progression. This is not human/phone validation.',obstacles,summary,results},null,2));
console.log('SUMMARY '+JSON.stringify(summary));
}

// Tests may reuse the observation-only policy without running or overwriting
// the fifteen report scenarios as an import side effect.
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
