import test from 'node:test';
import assert from 'node:assert/strict';
import {SurvivalRun,getUpgradeDefs} from '../survival-core.js';
import {upgradePresentation} from '../upgrade-presentation.js';

function arena(character='steve',weapon='wooden-sword',skill='bow'){
 const r=new SurvivalRun({character,weapon,skill,obstacles:[],rng:()=>.5});r.start();r.state.enemies=[];r.state.drops=[];r.state.projectiles=[];r._spawnClock=99999;r.state.player.x=r.state.player.z=0;return r;
}
function offer(r,id){r.state.phase='upgrade';r.state.choices=[getUpgradeDefs(r.character,r.weaponId).find(u=>u.id===id)];assert.equal(r.chooseUpgrade(id),true);}
const arts=new Set(['damage-melee','damage-ranged','damage-shell','rate','area-melee','area-ranged','area-shell','pierce','knockback','ricochet','burn','speed','maxhp','regen','pickup']);

test('every upgrade has compact contextual copy, known artwork and no hero labels without mutating its state',()=>{
 for(const [character,weapon]of [['steve','wooden-sword'],['steve','crossbow'],['shelly','wooden-sword'],['pudge','wooden-sword']]){
  const r=arena(character,weapon),before=structuredClone(r.state);
  for(const definition of getUpgradeDefs(character,weapon)){
   const p=upgradePresentation(r.state,definition.id);assert.equal(p.name,definition.name);assert.ok(arts.has(p.art));assert.ok(p.bonuses.length>=1&&p.bonuses.length<=3);
   for(const bonus of p.bonuses){assert.ok(bonus.length<=40,bonus);assert.doesNotMatch(bonus,/Стив|Шелли|Пудж|ближнее|дальнее/i);}
  }
  assert.deepEqual(r.state,before);
 }
});

test('damage and area art distinguish real melee, ranged and shotgun while gloves/arrow art is shared',()=>{
 const melee=arena().state,ranged=arena('steve','crossbow').state,shell=arena('shelly').state;
 assert.equal(upgradePresentation(melee,'damage').art,'damage-melee');assert.equal(upgradePresentation(ranged,'damage').art,'damage-ranged');assert.equal(upgradePresentation(shell,'damage').art,'damage-shell');
 assert.equal(upgradePresentation(melee,'pellets').art,'area-melee');assert.equal(upgradePresentation(ranged,'pellets').art,'area-ranged');assert.equal(upgradePresentation(shell,'pellets').art,'area-shell');
 for(const s of[melee,ranged,shell])assert.equal(upgradePresentation(s,'rate').art,'rate');
 assert.equal(upgradePresentation(melee,'pierce').art,'knockback');assert.equal(upgradePresentation(ranged,'pierce').art,'pierce');assert.equal(upgradePresentation(shell,'pierce').art,'pierce');
});

test('area copy matches actual range/arc/projectile deltas and omits an unavailable bow skill',()=>{
 const melee=arena(),m=structuredClone(melee.state.player.weapon);offer(melee,'pellets');assert.ok(Math.abs(melee.state.player.weapon.range-m.range-.22)<1e-9);assert.ok(Math.abs((melee.state.player.weapon.arc-m.arc)*180/Math.PI-12)<1e-9);assert.ok(Math.abs(melee.state.player.weapon.bowRange-m.bowRange-.7)<1e-9);
 assert.deepEqual(upgradePresentation(melee.state,'pellets').bonuses,['+0,22 м дальности','+12° к сектору удара','+0,7 м дальности лука']);
 assert.equal(upgradePresentation(arena('steve','wooden-sword','dash').state,'pellets').bonuses.length,2);
 const ranged=arena('steve','hunting-bow'),old=ranged.state.player.weapon.range;offer(ranged,'pellets');assert.ok(Math.abs(ranged.state.player.weapon.range-old-.6)<1e-9);const e=ranged._spawnEnemy('walker',0,5,null);ranged._shootRanged(e);assert.equal(ranged.state.projectiles.length,2);assert.ok(Math.abs(ranged.state.projectiles[1].damage/ranged.state.projectiles[0].damage-.45)<1e-9);
 const shell=arena('shelly'),pellets=shell.state.player.weapon.pellets;offer(shell,'pellets');assert.equal(shell.state.player.weapon.pellets-pellets,2);assert.deepEqual(upgradePresentation(shell.state,'pellets').bonuses,['+2 дробинки в залпе']);
});

test('rate describes delay reduction rather than incorrectly claiming only sixteen percent more shots',()=>{
 const r=arena(),before=r.state.player.weapon.fireInterval;assert.equal(upgradePresentation(r.state,'rate').bonuses[0],'−16% задержки атак');offer(r,'rate');assert.ok(Math.abs(r.state.player.weapon.fireInterval/before-.84)<1e-9);assert.ok(Math.abs(before/r.state.player.weapon.fireInterval-1-4/21)<1e-9);
 const capped=arena('steve','snow-caster','dash');for(let i=0;i<4;i++)offer(capped,'rate');const beforeFire=Math.max(.22,capped.state.player.weapon.fireInterval);const presentation=upgradePresentation(capped.state,'rate');offer(capped,'rate');const afterFire=Math.max(.22,capped.state.player.weapon.fireInterval);assert.equal(presentation.bonuses[0],`−${Math.round((1-afterFire/beforeFire)*100)}% задержки атак`);assert.notEqual(presentation.bonuses[0],'−16% задержки атак');
});

test('return swing preview follows the real 35/50/65 percent echo damage at each rank',()=>{
 const r=arena();for(const expected of[35,50,65]){
  const presentation=upgradePresentation(r.state,'ricochet');assert.equal(presentation.bonuses[0],`Повторный удар: ${expected}% урона`);offer(r,'ricochet');
  const e=r._spawnEnemy('walker',0,1,null);e.hp=e.maxHp=1000;e.speed=0;r.state.player.aimX=0;r.state.player.aimZ=1;r._swing();r._updateMelee(1);const before=e.hp;r._updateMelee(.16);assert.ok(Math.abs((before-e.hp)/r.state.player.weapon.damage-expected/100)<1e-9);r.state.enemies=[];
 }
 assert.equal(upgradePresentation(arena('steve','crossbow').state,'ricochet').bonuses[0],'+1 рикошет снаряда');
});

test('burn previews the next actual DPS including the staff inherent burn rank',()=>{
 for(const [weapon,expected]of [['wooden-sword',8],['ember-staff',12]]){
  const r=arena('steve',weapon),p=upgradePresentation(r.state,'burn');assert.deepEqual(p.bonuses,['Поджог на 3 с',`${expected} урона/с`]);offer(r,'burn');assert.equal(4+r.state.player.weapon.burn*4,expected);
 }
 const r=arena('steve','ember-staff');for(let i=0;i<3;i++)offer(r,'burn');assert.equal(upgradePresentation(r.state,'burn').bonuses[1],'24 урона/с');
});

test('pierce copy distinguishes knockback, ordinary ranged damage falloff and full-damage shotgun pellets',()=>{
 assert.deepEqual(upgradePresentation(arena().state,'pierce').bonuses,['+0,25 м отбрасывания','Стрелы: ещё 1 цель']);assert.equal(upgradePresentation(arena('pudge').state,'pierce').bonuses.length,1);
 assert.deepEqual(upgradePresentation(arena('steve','crossbow').state,'pierce').bonuses,['Пробивает ещё 1 цель','−28% урона за пробитие']);assert.match(upgradePresentation(arena('steve','tide-trident').state,'pierce').bonuses[1],/30%/);
 assert.deepEqual(upgradePresentation(arena('shelly').state,'pierce').bonuses,['Пробивает ещё 1 цель']);
});

test('health/regeneration/speed/experience copy preserves the actual additive and capped effects',()=>{
 const r=arena(),p=r.state.player;p.hp=p.maxHp;const max=p.maxHp,speed=p.speed;assert.deepEqual(upgradePresentation(r.state,'maxhp').bonuses,['+25 макс. здоровья','Лечение до 30 здоровья']);offer(r,'maxhp');assert.equal(p.maxHp,max+25);assert.equal(p.hp,max+25);
 offer(r,'regen');assert.equal(p.regen,.65);offer(r,'speed');assert.equal(p.speed,speed*1.09);const radius=p.pickupRadius;for(let i=0;i<3;i++)offer(r,'pickup');assert.ok(Math.abs(p.xpMultiplier-1.24)<1e-9);assert.equal(p.pickupRadius,radius+3);assert.deepEqual(upgradePresentation(r.state,'pickup').bonuses,['+1 м притяжения опыта','+8% опыта']);
});

test('hidden prototype and incomplete/unknown inputs have safe presentation fallbacks',()=>{
 const r=arena('pudge');assert.deepEqual(upgradePresentation(r.state,'rot').bonuses,['12 урона/с вокруг','Радиус 2,3 м','Враги на 20% медленнее']);offer(r,'rot');assert.deepEqual(upgradePresentation(r.state,'rot').bonuses,['16 урона/с вокруг','Радиус 2,5 м','Враги на 20% медленнее']);
 assert.equal(upgradePresentation({character:'steve',weaponId:'crossbow'},'damage').art,'damage-ranged');assert.equal(upgradePresentation(null,'damage').art,'damage-shell');assert.deepEqual(upgradePresentation({},'missing'),{art:'damage-melee',name:'Улучшение',bonuses:[]});
});
