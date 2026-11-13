import {writeFile} from 'node:fs/promises';
import {SurvivalRun} from '../survival-core.js';

// Automated player policy, not a proof of difficulty on a physical phone.
// Uses normal health, real equipment, earned choices, collisions and attacks.
const obstacles=[{x:-4.5,z:2.5,w:2,d:1},{x:4.5,z:1.5,w:1,d:2},{x:.5,z:-3.5,w:2,d:1},{x:-6.5,z:-5.5,w:1,d:2},{x:6.5,z:-5.5,w:2,d:1},{x:-9.5,z:3.5,w:1,d:1},{x:9.5,z:3.5,w:1,d:1}];
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const median=values=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const results=[];
for(const weapon of ['wooden-sword','diamond-sword'])for(const seed of [44,171,519]){
 const r=new SurvivalRun({mode:'endless',map:'cubic',character:'steve',weapon,obstacles,rng:seeded(seed)});r.start();
 const priority=['damage','pellets','rate','ricochet','burn','regen','maxhp','pierce','speed','pickup'],choices=[];let peak=0;
 const absorb=()=>{for(const e of r.drainEvents())if(e.type==='levelup')choices.push(r.state.elapsed);};
 for(let i=0;i<60*660&&r.state.elapsed<600&&r.state.phase!=='dead';i++){
  const s=r.state,p=s.player;
  if(s.phase==='upgrade'){
   const list=[...s.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));
   const heal=p.hp<p.maxHp*.6?list.find(c=>c.id==='maxhp'||c.id==='regen'):null;r.chooseUpgrade((heal||list[0]).id);absorb();continue;
  }
  const drop=[...s.drops].sort((a,b)=>{const rank=d=>d.type==='heal'&&p.hp<p.maxHp*.7?0:d.type==='shield'?1:2;return rank(a)-rank(b)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z);})[0];
  let x=Math.cos(i/140),z=Math.sin(i/140);
  if(drop){const d=Math.hypot(drop.x-p.x,drop.z-p.z)||1;x=(drop.x-p.x)/d;z=(drop.z-p.z)/d;}
  const boss=s.enemies.find(e=>e.id===s.bossId);if(boss&&p.hp>p.maxHp*.5){const dx=boss.x-p.x,dz=boss.z-p.z,d=Math.hypot(dx,dz)||1;if(d>p.weapon.range*.8){x=dx/d;z=dz/d;}else{x=-dz/d;z=dx/d;}}
  let nearby=0;
  for(const e of s.enemies){const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||.1;if(d<7)nearby++;if(d<2.25){const w=(2.25-d)*2.7;x+=dx/d*w;z+=dz/d*w;}}
  for(const shot of s.projectiles){if(shot.team!=='enemy')continue;const dx=p.x-shot.x-shot.vx*.15,dz=p.z-shot.z-shot.vz*.15,d=Math.hypot(dx,dz)||.1;if(d<1.7){x+=dx/d*(1.7-d)*3;z+=dz/d*(1.7-d)*3;}}
  for(const w of s.warnings){const dx=p.x-w.x,dz=p.z-w.z,d=Math.hypot(dx,dz)||.1;if(d<w.radius+1){x+=dx/d*5;z+=dz/d*5;}}
  if(p.x>8)x-=1.5;if(p.x<-8)x+=1.5;if(p.z>9)z-=1.5;if(p.z<-9)z+=1.5;
  r.update(1/60,{x,z,super:p.super>=100&&(nearby>=3||p.hp<60)});peak=Math.max(peak,r.state.enemies.length);absorb();
 }
 const gaps=choices.map((t,i)=>t-(choices[i-1]||0)),report={weapon,seed,phase:r.state.phase,time:+r.state.elapsed.toFixed(2),hp:+r.state.player.hp.toFixed(2),maxHp:r.state.player.maxHp,kills:r.state.kills,bosses:r.state.stats.bosses,level:r.state.level,choices:choices.map(n=>+n.toFixed(2)),medianChoiceGap:+(median(gaps)||0).toFixed(2),firstThreeGaps:gaps.slice(0,3).map(n=>+n.toFixed(2)),laterMedian:+(median(gaps.slice(5))||0).toFixed(2),bonuses:r.state.stats.bonuses,peak};
 results.push(report);console.log(JSON.stringify(report));
}
await writeFile(new URL('../artifacts/endless-balance-samples.json',import.meta.url),JSON.stringify({policy:'Automated earned-upgrade player; no stat cheats; source game/tools/simulate-endless-balance.mjs',results},null,2));
