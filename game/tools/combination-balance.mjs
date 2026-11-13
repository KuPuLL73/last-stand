import {writeFile} from 'node:fs/promises';
import {getRunUpgradeDefs,SurvivalRun} from '../survival-core.js';
import {getUpgradeCombination} from '../upgrade-combinations.js';
import {endlessXpNeeded} from '../endless-director.js';
import {policy} from './combat-balance-samples.mjs';

const obstacles = [
  {x:-4.5,z:2.5,w:2,d:1}, {x:4.5,z:1.5,w:1,d:2}, {x:.5,z:-3.5,w:2,d:1},
  {x:-6.5,z:-5.5,w:1,d:2}, {x:6.5,z:-5.5,w:2,d:1}, {x:-9.5,z:3.5,w:1,d:1}, {x:9.5,z:3.5,w:1,d:1},
];
const loadouts = [
  {character:'steve',weapon:'iron-sword'},
  {character:'steve',weapon:'hunting-bow'},
  {character:'steve',weapon:'crossbow'},
  {character:'steve',weapon:'netherite-axe'},
  {character:'steve',weapon:'tide-trident'},
  {character:'steve',weapon:'snow-caster'},
  {character:'steve',weapon:'ember-staff'},
  {character:'shelly',weapon:'wooden-sword'},
];
const seeds = (process.env.COMBO_SEEDS || '44,171,519').split(',').map(Number);
const seconds = Number(process.env.COMBO_SECONDS) || 900;
const selected = process.env.COMBO_WEAPONS?.split(',');
const label = process.env.COMBO_LABEL || 'current';
const lateBuild = process.env.COMBO_LATE_BUILD === '1';
const latePellets = Number(process.env.COMBO_LATE_PELLETS ?? 2);
const skill = process.env.COMBO_SKILL ?? 'bow';
const rounded = n => Math.round(n * 100) / 100;
function seeded(seed) {
  return () => {seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296;};
}

function choose(run, combination) {
  const {state} = run;
  const {player, upgrades} = state;
  const requirements = combination.requirements.map(item => item.id);
  const value = ({id}) => {
    if (id === combination.id) return 20;
    if (player.hp < player.maxHp * .7 && id === 'maxhp') return 16;
    if (player.hp < player.maxHp * .85 && id === 'regen' && upgrades.regen < 2) return 15;
    if (id === 'damage' && upgrades.damage < 3) return 14;
    if (id === 'rate' && upgrades.rate < 2) return 13;
    if (id === 'pickup' && !upgrades.pickup) return 11;
    if (requirements.includes(id)) return 10;
    return {damage:8,rate:7,pellets:6,regen:5,maxhp:4,pickup:3,pierce:2,burn:1}[id] ?? 0;
  };
  const choice = state.choices.reduce((best, item) => value(item) > value(best) ? item : best);
  run.chooseUpgrade(choice.id);
  return choice.id;
}

function prepareLateBuild(run, combination) {
  const {state} = run;
  const definitions = getRunUpgradeDefs(state.character, run.weaponId);
  const ranks = {damage:3,rate:2,maxhp:2,regen:2,pickup:1,pellets:latePellets};
  for (const requirement of combination.requirements) ranks[requirement.id] = requirement.rank;
  ranks[combination.id] = combination.max;
  for (const [id, count] of Object.entries(ranks)) {
    const definition = definitions.find(item => item.id === id);
    for (let rank = 1; rank <= count; rank++) {
      state.phase = 'upgrade';
      state.choices = [{...definition,rank}];
      if (!run.chooseUpgrade(id)) throw new Error(`Cannot prepare ${id} ${rank}`);
    }
  }
  state.elapsed = 480;
  state.nextBossAt = 540;
  state.level = 1 + Object.values(state.upgrades).reduce((sum, rank) => sum + rank, 0);
  state.xpNeeded = endlessXpNeeded(state.level);
  state.stats.bosses = 3;
  state.bossSequence = 3;
  return {rank:combination.max, level:state.level, time:state.elapsed};
}

const results = [];
for (const loadout of loadouts) {
  if (selected && !selected.includes(loadout.character === 'shelly' ? 'shelly' : loadout.weapon)) continue;
  for (const seed of seeds) {
    const run = new SurvivalRun({...loadout, skill, obstacles, mode:'endless', map:'cubic', rng:seeded(seed)});
    const combination = getUpgradeCombination(loadout.character, loadout.weapon);
    const procs = [], ranks = [];
    let comboDamage = 0;
    const originalDamage = run._damageEnemy;
    run._damageEnemy = function(enemy, damage, cause, flash) {
      const before = enemy.hp;
      originalDamage.call(this, enemy, damage, cause, flash);
      if (cause === 'combo') comboDamage += before - enemy.hp;
    };
    run.start();
    if (lateBuild) ranks.push(prepareLateBuild(run, combination));
    const end = run.state.elapsed + seconds;
    const memory = {};
    let nextDecision = 0, input = {};
    for (let guard = 0; guard < seconds * 36 + 1000 && run.state.elapsed < end - 1e-8; guard++) {
      const state = run.state;
      if (state.phase === 'dead') break;
      if (state.phase === 'upgrade') {
        if (choose(run, combination) === combination.id) ranks.push({rank:state.upgrades[combination.id], level:state.level, time:rounded(state.elapsed)});
      } else {
        if (state.elapsed >= nextDecision) {
          input = policy(run, memory);
          nextDecision = state.elapsed + .1;
        }
        run.update(Math.min(1/30, end - state.elapsed), input);
      }
      for (const event of run.drainEvents()) {
        if (event.type === 'comboproc') procs.push({time:rounded(state.elapsed),rank:event.rank});
      }
    }
    const state = run.state;
    const row = {
      ...loadout, seed, combo:combination.id, elapsed:rounded(state.elapsed), level:state.level, kills:state.kills,
      bosses:state.stats.bosses, ranks, procCount:procs.length, firstProc:procs[0]?.time ?? null,
      comboDamage:rounded(comboDamage), totalDamage:rounded(state.stats.damageDealt),
      comboDamagePercent:rounded(comboDamage * 100 / Math.max(1,state.stats.damageDealt)),
      procsPerActiveMinute: ranks.length ? rounded(procs.length * 60 / Math.max(1,state.elapsed-ranks[0].time)) : null,
      upgrades:state.upgrades, procs,
    };
    results.push(row);
    const {procs:_, ...summary} = row;
    console.log(JSON.stringify(summary));
  }
}
await writeFile(new URL(`../artifacts/combination-balance-${label}.json`,import.meta.url), JSON.stringify({
  seconds,seeds,skill,lateBuild,latePellets, methodology:'Tactical movement every 0.1 s, normal 60 Hz substeps. Normal health and no invulnerability. Loadouts start equipped. Early choices prioritize damage, rate and survival, then the recipe. Late fixture starts at 480 s with assumed three defeated bosses and preselected ranks. All shots, procs and incoming damage use live combat rules. Damage wrapper observes actual health loss. Not a human playtest.', results,
},null,2));
