import test from 'node:test';
import assert from 'node:assert/strict';
import {runReward,WEAPON_PRICES,SKILL_PRICES,ACHIEVEMENT_REWARDS} from '../economy.js';
import {STEVE_WEAPONS} from '../steve-weapons.js';

test('reward separates combat, qualified time and progressive boss victories',()=>{
 assert.deepEqual(runReward({kills:100,elapsed:300,stats:{bosses:2}}),{combat:45,survival:60,boss:210,total:315,earnedMinutes:5,bosses:2});
 assert.equal(runReward({kills:150,elapsed:600}).total,187);
 assert.equal(runReward({kills:100,elapsed:240,phase:'won',stats:{bosses:1}}).total,183);
});
test('idle time cannot pay without kills and a quick restart cannot multiply a completed reward',()=>{
 assert.equal(runReward({kills:0,elapsed:7200}).total,0);
 const one=runReward({kills:10,elapsed:60}),hour=runReward({kills:10,elapsed:3600});assert.equal(hour.total,one.total);assert.equal(hour.survival,0);
 assert.equal(runReward({kills:15,elapsed:7200}).survival,12);
 assert.equal(runReward({kills:10000,elapsed:7200}).survival,180,'active-time component has a finite fifteen-minute cap');
});
test('later boss victories improve the marginal payout without unbounded multipliers',()=>{
 let last=0;const marginal=[];
 for(let b=1;b<=8;b++){const next=runReward({stats:{bosses:b}}).boss;marginal.push(next-last);last=next;}
 assert.deepEqual(marginal,[90,120,150,180,210,210,210,210]);
});
test('death and voluntary retirement preserve the same earned combat and boss payouts',()=>{
 const states=['dead','retired','won'].map(phase=>runReward({phase,kills:100,elapsed:300,stats:{bosses:2}}));assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);
 assert.equal(runReward({phase:'won',kills:0,elapsed:240,stats:{bosses:0}}).boss,90,'a campaign win is at least one boss');
});
test('invalid or negative counters cannot produce negative, infinite or NaN currency',()=>{
 for(const state of [{},{kills:-3,elapsed:-60,stats:{bosses:-2}},{kills:NaN,elapsed:Infinity,stats:{bosses:NaN}}])assert.equal(runReward(state).total,0);
 assert.ok(Number.isFinite(runReward({kills:1e6,elapsed:1e9,stats:{bosses:1e9}}).total));
});
test('all seventeen catalog entries have explicit prices and specialist equipment is a saving goal',()=>{
 assert.equal(STEVE_WEAPONS.length,17);assert.equal(WEAPON_PRICES['wooden-sword'],0);
 for(const w of STEVE_WEAPONS){assert.equal(w.price,WEAPON_PRICES[w.id]);if(w.id!=='wooden-sword')assert.ok(w.price>=300);}
 assert.equal(WEAPON_PRICES['stone-sword'],300);assert.equal(WEAPON_PRICES.crossbow,2500);assert.equal(WEAPON_PRICES['netherite-axe'],6800);
 assert.equal(SKILL_PRICES.dash,1100);assert.equal(SKILL_PRICES.bulwark,1700);
 assert.equal(Object.values(ACHIEVEMENT_REWARDS).reduce((a,b)=>a+b,0),600);
});
