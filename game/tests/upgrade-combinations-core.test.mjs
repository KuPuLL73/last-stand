import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getRunUpgradeDefs,getUpgradeDefs} from '../survival-core.js';
import {getUpgradeCombination,isCombinationUnlocked} from '../upgrade-combinations.js';

const cases = [
  {character:'steve',weapon:'iron-sword',id:'echo-wave'},
  {character:'steve',weapon:'ember-staff',id:'fire-ricochet'},
  {character:'shelly',weapon:'wooden-sword',id:'shrapnel-line'},
];

function arena(options) {
  const run = new SurvivalRun({obstacles:[], rng:()=>0, mode:'endless', ...options});
  run.start();
  const {state} = run;
  state.enemies = [];
  state.player.x = state.player.z = state.player.super = 0;
  state.player.cooldown = 1e6;
  run._spawnClock = 1e6;
  run._nextBonusAt = 1e6;
  run.drainEvents();
  return run;
}

function roll(run, desiredId) {
  const {state} = run;
  const available = getUpgradeDefs(state.character, run.weaponId).filter(card => state.upgrades[card.id] < card.max);
  const index = available.findIndex(card => card.id === desiredId);
  const original = run.rng;
  if (index >= 0) run.rng = () => (index + .1) / available.length;
  state.xp = state.xpNeeded;
  run._checkLevel();
  run.rng = original;
  return state.choices;
}

function equipCombination(run, rank=1) {
  const definition = getUpgradeCombination(run.state.character, run.weaponId);
  for (const {id,rank:max} of definition.requirements) {
    for (let n = 0; n < max; n++) {
      roll(run, id);
      assert.ok(run.chooseUpgrade(id));
    }
  }
  for (let n = 0; n < rank; n++) {
    roll(run);
    assert.ok(run.chooseUpgrade(definition.id));
  }
  run.drainEvents();
}

function enemy(run, x, z, hp=200, type='walker') {
  const target = run._spawnEnemy(type,x,z,null);
  Object.assign(target,{hp,maxHp:hp,speed:0,damage:0,attackCooldown:1e6,abilityCooldown:1e6,volleyCooldown:1e6});
  return target;
}

const procs = run => run.drainEvents().filter(event => event.type === 'comboproc');
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-6, `${actual} != ${expected}`);

for (const {character,weapon,id} of cases) {
  test(`${id} requires both max ranks, then offers three earned ranks and resets on restart`, () => {
    const run = arena({character,weapon});
    const {state} = run;
    const definition = getUpgradeCombination(character,weapon);
    assert.equal(getRunUpgradeDefs(character,weapon).filter(card => card.requirements).length,1);
    assert.equal(state.upgrades[id],0);
    for (const requirement of definition.requirements) {
      assert.equal(requirement.rank,getUpgradeDefs(character,weapon).find(card => card.id === requirement.id).max);
      for (let n = 0; n < requirement.rank; n++) {
        const choices = roll(run,requirement.id);
        assert.ok(!choices.some(card => card.id === id));
        assert.equal(run.chooseUpgrade(id),false);
        assert.ok(run.chooseUpgrade(requirement.id));
      }
    }
    assert.ok(isCombinationUnlocked(definition,state.upgrades));
    assert.equal(state.upgrades[id],0,'finishing the recipe does not grant the effect');
    for (let rank = 1; rank <= 3; rank++) {
      const choices = roll(run);
      assert.equal(choices.length,3);
      assert.equal(choices.find(card => card.id === id)?.rank,rank);
      assert.ok(run.chooseUpgrade(id));
      assert.equal(state.upgrades[id],rank);
    }
    assert.ok(!roll(run).some(card => card.id === id));
    run.restart();
    assert.equal(run.state.comboReadyAt,0);
    assert.ok(!isCombinationUnlocked(definition,run.state.upgrades));
    assert.equal(run.state.upgrades[id],0);
  });
}

test('recipe assistance preserves two ordinary choices and requires investment in both cards', () => {
  const offerAt = (level, ricochet, burn) => {
    const run = arena({character:'steve',weapon:'hunting-bow'});
    Object.assign(run.state.upgrades,{ricochet,burn});
    run.state.level = level - 1;
    return roll(run).map(card => card.id);
  };
  assert.deepEqual(offerAt(7,2,2),['damage','rate','pellets']);
  assert.deepEqual(offerAt(8,0,4),['damage','rate','pellets']);
  assert.deepEqual(offerAt(8,1,2),['damage','rate','pellets']);
  assert.deepEqual(offerAt(8,2,2),['damage','rate','burn']);
  assert.deepEqual(offerAt(9,2,2),['damage','rate','pellets']);
  assert.deepEqual(offerAt(10,3,3),['damage','rate','burn']);
});

test('Echo Wave comes from a killing return swing, respects cover and caps boss damage', () => {
  const run = arena({character:'steve',weapon:'netherite-axe'});
  equipCombination(run,3);
  const {state} = run;
  const {player} = state;
  player.weapon.damage = 180;
  const directKill = enemy(run,0,3,8);
  const swing = echo => {
    player.pendingAttack = {remaining:0,dx:0,dz:1,range:3.15,arc:.45,echo};
    run._updateMelee(1/60);
  };
  swing(false);
  assert.equal(directKill.hp,0);
  assert.equal(procs(run).length,0);
  const echoKill = enemy(run,0,3,15);
  const exposed = enemy(run,0,4.25);
  const boss = enemy(run,-.35,4.65,300,'boss');
  const sheltered = enemy(run,1.4,3);
  run.obstacles = [{x:.65,z:3,w:.18,d:.65}];
  swing(true);
  assert.equal(echoKill.hp,0);
  assert.equal(exposed.hp,152);
  close(boss.hp,300-48*.55);
  assert.equal(sheltered.hp,200);
  assert.equal(procs(run)[0]?.radius,2.25);
  assert.equal(state.comboReadyAt,3.2);
  enemy(run,0,3,15);
  swing(true);
  assert.equal(exposed.hp,152);
  assert.equal(procs(run).length,0);
  run.pause();
  run.update(.25);
  assert.equal(state.elapsed,0);
  assert.equal(state.comboReadyAt,3.2);
});

test('Fire Ricochet requires a genuine bounce, respects cover and never overwrites stronger burning', () => {
  const run = arena({character:'steve',weapon:'crossbow'});
  equipCombination(run,3);
  const {state} = run;
  const primary = enemy(run,-1.8,0);
  const exposed = enemy(run,-2.15,1.05);
  const strongBurn = enemy(run,-1.8,-1.1);
  const sheltered = enemy(run,.45,.45);
  run._setBurn(strongBurn,24,3);
  run.obstacles = [{x:0,z:0,w:.4,d:1.55}];
  const shot = x => ({id:run._id(),team:'player',kind:'bolt',x,z:0,vx:30,vz:0,life:1,radius:.12,damage:10,pierce:0,bounces:3,burn:4,hitIds:[]});
  state.projectiles.push(shot(-2.8));
  run._updateProjectiles(1/30);
  assert.equal(primary.burnDps,20);
  assert.equal(primary.burnCombo,false);
  assert.equal(exposed.burn,0);
  assert.equal(procs(run).length,0);
  const banked = shot(-1);
  state.projectiles.push(banked);
  run._updateProjectiles(1/30);
  assert.ok(banked.vx<0,'cover physically reflected the projectile');
  assert.equal(procs(run).length,0);
  run._updateProjectiles(1/30);
  assert.equal(exposed.burnDps,14);
  assert.equal(exposed.burn,3);
  assert.equal(strongBurn.burnDps,24);
  assert.equal(sheltered.burn,0);
  assert.equal(procs(run)[0]?.combo,'fire-ricochet');
  assert.equal(state.comboReadyAt,2.6);
  assert.equal(primary.burnCombo,false,'normal burns keep their source');
  state.enemies = [exposed];
  exposed.hp = 1;
  state.player.super = 0;
  run._updateEnemies(.1);
  assert.equal(exposed.hp,0);
  assert.equal(state.player.super,0,'combo burn kills award XP but no extra super charge');
  assert.ok(state.drops.some(drop => drop.type==='xp'));
  assert.ok(run.drainEvents().some(event => event.type==='kill'&&event.cause==='combo'));
});

test('Shrapnel needs three penetrations from one volley and emits capped secondary pellets behind the target', () => {
  const run = arena({character:'shelly'});
  equipCombination(run,3);
  const {state} = run;
  const {player} = state;
  player.aimX = 0;
  player.aimZ = 1;
  player.weapon.damage = 100;
  const front = enemy(run,0,2,4000);
  const behind = enemy(run,0,5,4000);
  run._shoot(front);
  const first = state.projectiles.splice(0);
  run._shoot(front);
  const second = state.projectiles.splice(0);
  state.projectiles.push(...first.slice(5,7),...second.slice(5,7));
  for(let i=0;i<5;i++)run._updateProjectiles(1/60);
  assert.equal(procs(run).length,0,'two hits from two different volleys never combine');
  state.projectiles = [];
  run._shoot(front);
  for(let i=0;i<4;i++)run._updateProjectiles(1/60);
  const event = procs(run)[0];
  assert.equal(event?.combo,'shrapnel-line');
  assert.equal(event.range,3.4);
  assert.ok(event.z>front.z+front.radius);
  const secondary = state.projectiles.filter(shot => shot.comboSource === 'shrapnel-line');
  assert.equal(secondary.length,3);
  assert.ok(secondary.every(shot => shot.damage===18 && shot.pierce===0 && shot.burn===0 && shot.bounces===0 && shot.hitIds.includes(front.id)));
  for(let i=0;i<9;i++)run._updateProjectiles(1/60);
  const events = run.drainEvents();
  assert.ok(events.some(hit => hit.type==='hit' && hit.id===behind.id && hit.cause==='combo' && hit.damage===18));
  assert.ok(!events.some(hit => hit.type==='comboproc'));
});
