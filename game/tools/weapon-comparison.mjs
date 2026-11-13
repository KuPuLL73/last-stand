import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';
import {STEVE_WEAPONS} from '../steve-weapons.js';
import {policy,chooseUpgrade} from './combat-balance-samples.mjs';
import {MAP} from '../logic.js';

const round=n=>Math.round(n*100)/100;
const seeds=(process.env.WEAPON_BENCH_SEEDS||'44,171,519').split(',').map(Number);
const naturalSeconds=Number(process.env.WEAPON_BENCH_SECONDS)||180;
const controlSeconds=12;
const obstacles=[{x:-4.5,z:2.5,w:2,d:1},{x:4.5,z:1.5,w:1,d:2},{x:.5,z:-3.5,w:2,d:1},{x:-6.5,z:-5.5,w:1,d:2},{x:6.5,z:-5.5,w:2,d:1},{x:-9.5,z:3.5,w:1,d:1},{x:9.5,z:3.5,w:1,d:1}];
const fixedBuild=['damage','damage','rate','rate','pellets','pierce','ricochet','burn'];
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function prepare(weapon){
 const r=new SurvivalRun({weapon,character:'steve',mode:'endless',map:'cubic',obstacles:[],rng:seeded(99)});r.start();
 r.state.enemies=[];r.state.drops=[];r.state.projectiles=[];r.state.warnings=[];r.state.nextBossAt=1e9;r._spawnClock=1e9;
 r.state.player.x=0;r.state.player.z=0;r.state.xpNeeded=1e9;r.state.player.super=0;r.drainEvents();return r;
}
function applyBuild(r){for(const id of fixedBuild){r.state.phase='upgrade';r.state.choices=[getUpgradeDefs('steve',r.weaponId).find(u=>u.id===id)];r.chooseUpgrade(id);}r.drainEvents();}
function dummy(r,x,z){const e=r._spawnEnemy('walker',x,z,null);Object.assign(e,{hp:1e6,maxHp:1e6,speed:0,damage:0,attackCooldown:1e9});return {e,x,z};}
function controlled(weapon,scenario,upgraded=false){
 const r=prepare(weapon.id);if(upgraded)applyBuild(r);
 let anchors;
 if(scenario==='single')anchors=[dummy(r,0,2)];
 else if(scenario==='crowd')anchors=Array.from({length:12},(_,i)=>{const a=(i%6-2.5)*.24,range=1.9+Math.floor(i/6)*.42;return dummy(r,Math.sin(a)*range,Math.cos(a)*range);});
 else{anchors=Array.from({length:6},(_,i)=>dummy(r,0,3+i*1.3));r.state.player.z=-6;}
 const hitIds=new Set();let firstHit=null;
 for(let time=0;time<controlSeconds-1e-9;time+=1/60){
  // Anchor training dummies only. This intentionally removes knockback travel
  // from the raw damage test; real knockback/uptime remain in natural runs.
  for(const a of anchors){a.e.x=a.x;a.e.z=a.z;}
  const p=r.state.player,closest=anchors[0],distance=Math.hypot(closest.x-p.x,closest.z-p.z);
  const approach=scenario==='closing-lane'&&distance>p.weapon.range*.78;
  r.update(1/60,{z:approach?1:0});
  for(const event of r.drainEvents())if(event.type==='hit'){hitIds.add(event.id);firstHit??=r.state.elapsed;}
 }
 const damage=r.state.stats.damageDealt;
 return {scenario,upgraded,damage:round(damage),dps:round(damage/controlSeconds),firstHit:round(firstHit??controlSeconds),hitTargets:hitIds.size,shots:r.state.stats.shots};
}
function natural(weapon,seed){
 const r=new SurvivalRun({weapon:weapon.id,character:'steve',mode:'endless',map:'cubic',obstacles,bounds:MAP,rng:seeded(seed)});r.start();
 const memory={},choices=[];let input={},nextDecision=0,peakAlive=0,damageTaken=0,firstHit=null;
 for(let guard=0;guard<naturalSeconds*60+1000&&r.state.elapsed<naturalSeconds-1e-8&&r.state.phase!=='dead';guard++){
  if(r.state.phase==='upgrade'){choices.push(chooseUpgrade(r));continue;}
  if(r.state.elapsed>=nextDecision){input=policy(r,memory);nextDecision=r.state.elapsed+.1;}
  r.update(Math.min(1/30,naturalSeconds-r.state.elapsed),input);peakAlive=Math.max(peakAlive,r.state.enemies.length);
  for(const event of r.drainEvents()){
   if(event.type==='hurt')damageTaken+=event.damage;
   if(event.type==='hit')firstHit??=r.state.elapsed;
  }
 }
 const s=r.state,p=s.player;
 return {seed,time:round(s.elapsed),survived:s.phase!=='dead'&&s.elapsed>=naturalSeconds-1e-8,hp:round(p.hp),maxHp:p.maxHp,kills:s.kills,level:s.level,bosses:s.stats.bosses,damageDealt:round(s.stats.damageDealt),damageTaken:round(damageTaken),peakAlive,firstHit:round(firstHit??s.elapsed),superUses:s.stats.superUses,choices,upgrades:s.upgrades};
}
export function pursuit(weapon){
 const r=prepare(weapon.id),enemy=r._spawnEnemy('walker',0,8,null);enemy.hp=enemy.maxHp=1e6;
 let firstContact=null,slowedSeconds=0;
 for(let t=0;t<20-1e-9&&firstContact===null;t+=1/60){
  r.update(1/60);if(enemy.slowTime>0)slowedSeconds+=1/60;
  for(const e of r.drainEvents())if(e.type==='hurt'&&e.damage>0)firstContact=r.state.elapsed;
 }
 return {firstContact:firstContact===null?null:round(firstContact),window:20,slowedSeconds:round(slowedSeconds),damage:round(r.state.stats.damageDealt),description:'One durable ordinary walker starts8m away and pursues a stationary ordinary-health Steve. No skill, no upgrades, no restored positions. Stop on first real contact; null means the weapon held it outside contact for20s. This measures control without conflating it with lethal damage.'};
}
export async function compareWeapons(){
 const fingerprints={};for(const file of ['survival-core.js','steve-weapons.js','extra-weapons.js','endless-director.js','economy.js'])fingerprints[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
 const ids=process.env.WEAPON_BENCH_IDS?.split(','),catalog=STEVE_WEAPONS.filter(w=>!ids||ids.includes(w.id));
 const rows=[];
 for(const weapon of catalog){
  const controls=[false,true].flatMap(upgraded=>['single','crowd','closing-lane'].map(s=>controlled(weapon,s,upgraded)));
  const runs=seeds.map(seed=>natural(weapon,seed));
  const average=key=>round(runs.reduce((n,r)=>n+r[key],0)/runs.length);
  const row={weapon:{...weapon},paperDps:round(weapon.damage/weapon.interval),controls,pursuit:pursuit(weapon),natural:runs,summary:{survived:runs.filter(r=>r.survived).length,runs:runs.length,averageKills:average('kills'),averageDamage:average('damageDealt'),averageDamageTaken:average('damageTaken'),averageLevel:average('level'),averageTime:average('time'),averageHealthFraction:round(runs.reduce((n,r)=>n+r.hp/r.maxHp,0)/runs.length)}};
  rows.push(row);console.log(JSON.stringify({id:weapon.id,...row.summary,baseSingle:controls.find(c=>c.scenario==='single'&&!c.upgraded).dps,baseCrowd:controls.find(c=>c.scenario==='crowd'&&!c.upgraded).dps,baseLane:controls.find(c=>c.scenario==='closing-lane'&&!c.upgraded).dps}));
 }
 const report={generatedAt:new Date().toISOString(),fingerprints,seeds,naturalSeconds,controlSeconds,fixedBuild,method:'Training dummies have anchored positions, 1,000,000 HP and no movement/damage; actual core attack/projectile/burn/cleave executes at60Hz. Single/crowd start at common close range. Closing lane starts player6m behind six targets. Base and identical fixed eight-rank build tested; no skills in controlled tests. Natural runs use ordinary HP, real spawned enemies, 100ms observation/input tactical policy, normal skills/earned upgrades, no HP/XP/invulnerability cheats. Policy has full state access and is not a human test. Natural weapon selection is a loadout scenario, not an economic unlock simulation.',rows};
 await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
 const suffix=process.env.WEAPON_BENCH_LABEL||'baseline';
 await writeFile(new URL(`../artifacts/weapon-comparison-${suffix}.json`,import.meta.url),JSON.stringify(report,null,2));
 const ordered=[...rows].sort((a,b)=>b.summary.averageKills-a.summary.averageKills);
 const line=r=>{const c=(s,u=false)=>r.controls.find(c=>c.scenario===s&&c.upgraded===u).dps;return `| ${r.weapon.name} | ${r.paperDps} | ${c('single')} | ${c('crowd')} | ${c('closing-lane')} | ${c('crowd',true)} | ${r.summary.averageKills} | ${r.summary.survived}/${r.summary.runs} | ${r.summary.averageDamageTaken} |`;};
 const md=`# Оружие — сравнительный прогон (${suffix})\n\n${report.method}\n\nSeed: ${seeds.join(', ')}. Natural: ${naturalSeconds}s, training: ${controlSeconds}s. Core SHA256: ${fingerprints['survival-core.js']}.\n\nУпорядочено по убийствам за естественный забег; это не универсальный рейтинг силы.\n\n| Оружие | Бумажный DPS | Single DPS | Crowd DPS | Closing lane DPS | Crowd fixed-build DPS | Kills natural avg | Survived | Damage taken avg |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${ordered.map(line).join('\n')}\n\nAnchored crowd deliberately measures cleave/pierce geometry with a fixed formation; it does not model moving enemies. Natural runs include movement, knockback, cover, collection decisions and different earned builds. A ranged-biased policy can overstate ranged safety. Full per-seed outcomes and parameters are in the JSON.\n`;
 await writeFile(new URL(`../artifacts/weapon-comparison-${suffix}.md`,import.meta.url),md);
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await compareWeapons();
