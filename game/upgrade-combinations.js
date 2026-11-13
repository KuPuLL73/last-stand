import {getSteveWeapon} from './steve-weapons.js';

function defineCombination(id, name, description, requirements, first, second, third) {
  const ranks = [first, {...first, ...second}, {...first, ...second, ...third}].map(Object.freeze);
  return Object.freeze({
    id, name, description, art: id, max: ranks.length,
    requirements: Object.freeze(requirements.map(Object.freeze)),
    ranks: Object.freeze(ranks),
  });
}

export const UPGRADE_COMBINATIONS = Object.freeze({
  'echo-wave': defineCombination(
    'echo-wave', 'Эхо клинка', 'Добивание обратным взмахом выпускает ударную волну.',
    [{id: 'pellets', rank: 4}, {id: 'ricochet', rank: 3}],
    {radius: 1.8, targetLimit: 3, damageScale: .30, damageCap: 48, bossScale: .55, cooldown: 4.5},
    {radius: 2.25, targetLimit: 4},
    {cooldown: 3.2},
  ),
  'fire-ricochet': defineCombination(
    'fire-ricochet', 'Огненный рикошет', 'Первое попадание после отскока поджигает врагов рядом.',
    [{id: 'ricochet', rank: 3}, {id: 'burn', rank: 4}],
    {radius: 1.65, targetLimit: 3, burnDps: 14, duration: 2, bossScale: .6, cooldown: 3.8},
    {radius: 2.2, targetLimit: 4},
    {duration: 3, cooldown: 2.6},
  ),
  'shrapnel-line': defineCombination(
    'shrapnel-line', 'Свинцовый прорыв', 'Три пробивающие дробинки одного залпа выпускают новый залп за целью.',
    [{id: 'pellets', rank: 4}, {id: 'pierce', rank: 3}],
    {pellets: 3, hitThreshold: 3, range: 2.4, spread: .26, damageScale: .50, damageCap: 18, cooldown: 3.8},
    {range: 3.4},
    {cooldown: 2.6},
  ),
});

export function getUpgradeCombination(character, weaponId) {
  if (character === 'shelly') return UPGRADE_COMBINATIONS['shrapnel-line'];
  if (character !== 'steve') return undefined;
  const id = getSteveWeapon(weaponId).attackMode === 'ranged' ? 'fire-ricochet' : 'echo-wave';
  return UPGRADE_COMBINATIONS[id];
}

export function combinationRank(id, rank) {
  return UPGRADE_COMBINATIONS[id]?.ranks?.[rank - 1];
}

export function isCombinationUnlocked(definition, upgrades) {
  return Boolean(definition?.requirements.every(({id, rank}) => (upgrades?.[id] ?? 0) >= rank));
}
