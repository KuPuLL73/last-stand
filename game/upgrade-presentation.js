import {getUpgradeDefs} from './survival-core.js';
import {STEVE_START_WEAPON,weaponStats} from './steve-weapons.js';
import {combinationRank,getUpgradeCombination} from './upgrade-combinations.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const number=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
const percent=(before,after)=>Math.max(0,Math.round((1-after/before)*100));

function combinationBonuses(combination,current,weapon){
 const next=Math.min(combination.max,current+1);
 const stats=combinationRank(combination.id,next);
 const previous=combinationRank(combination.id,current);
 const cooldown=`Раз в ${number(stats.cooldown)} с`;
 if(next===3){
  const bonuses=[`Перезарядка ${number(previous.cooldown)} → ${number(stats.cooldown)} с`];
  if(stats.duration!==undefined&&stats.duration!==previous.duration)bonuses.push(`Поджог ${number(previous.duration)} → ${number(stats.duration)} с`);
  return bonuses;
 }
 if(combination.id==='shrapnel-line'){
  if(next===2)return [`Дальность залпа ${number(previous.range)} → ${number(stats.range)} м`];
  const damage=Math.min(weapon.damage*stats.damageScale,stats.damageCap);
  return [`${stats.hitThreshold} пробития одной цели → залп`,`${stats.pellets} дробинки по ${number(damage)} урона · ${number(stats.range)} м`,cooldown];
 }
 if(next===2)return [`Радиус ${number(previous.radius)} → ${number(stats.radius)} м`,`До ${stats.targetLimit} целей`];
 if(combination.id==='fire-ricochet')return ['После отскока поджигает соседей',`${stats.burnDps} урона/с · ${number(stats.duration)} с · ${number(stats.radius)} м`,cooldown];
 const damage=Math.min(weapon.damage*stats.damageScale,stats.damageCap);
 return ['Волна при добивании вторым взмахом',`${number(damage)} урона · ${number(stats.radius)} м · до ${stats.targetLimit} целей`,cooldown];
}

function rateBonuses(state,player,weapon,{ranged,bow}){
 const interval=finite(weapon.fireInterval,.68),next=Math.max(.18,interval*.84),rapid=player.buffs?.rapid>0?.6:1;
 const before=Math.max(ranged?.22:0,interval*rapid),after=Math.max(ranged?.22:0,next*rapid),gain=percent(before,after);
 const bonuses=[gain?`−${gain}% задержки атак`:'Предельный темп атак'];
 if(bow){
  const rank=finite(state?.upgrades?.rate),bowBefore=ranged?Math.max(.18,before*.70):Math.max(.40,.80*Math.pow(.84,rank)*rapid);
  const bowAfter=ranged?Math.max(.18,after*.70):Math.max(.40,.80*Math.pow(.84,rank+1)*rapid),bowGain=percent(bowBefore,bowAfter);
  if(bowGain!==gain)bonuses.push(bowGain?`Лук: −${bowGain}% задержки`:'Предельный темп лука');
 }
 return bonuses;
}

/** Short, contextual copy for upgrade cards. No hero/type labels are added.
 * Values describe the next rank and respect current weapon/passive caps.
 * Combat rules remain in SurvivalRun; this module never changes run state. */
export function upgradePresentation(state,id){
 const player=state?.player||{},candidate=state?.character||player.character,character=['steve','shelly','pudge'].includes(candidate)?candidate:'shelly';
 const weaponId=player.weapon?.id||state?.weaponId||STEVE_START_WEAPON;
 const defaults=character==='steve'?weaponStats(weaponId):{fireInterval:character==='pudge'?.9:.68,burn:0,ricochet:0,pierce:0};
 const weapon={...defaults,...player.weapon},ranged=character==='steve'&&weapon.attackMode==='ranged';
 const combination=getUpgradeCombination(character,weaponId);
 if(combination?.id===id){
  const current=finite(state?.upgrades?.[id]);
  return {art:combination.art,name:combination.name,bonuses:combinationBonuses(combination,current,weapon),combination};
 }
 const bow=character==='steve'&&(player.skill||state?.skill||'bow')==='bow';
 const definition=getUpgradeDefs(character,weaponId).find(upgrade=>upgrade.id===id);
 if(!definition)return{art:'damage-melee',name:'Улучшение',bonuses:[]};
 const name=definition.name;
 switch(id){
  case'damage':return{art:character==='shelly'?'damage-shell':ranged?'damage-ranged':'damage-melee',name,bonuses:['+22% урона']};
  case'rate':return{art:'rate',name,bonuses:rateBonuses(state,player,weapon,{ranged,bow})};
  case'pellets':{
   if(character==='shelly')return{art:'area-shell',name,bonuses:['+2 дробинки в залпе']};
   const bonuses=ranged?['+1 снаряд · 45% урона','+0,6 м дальности']:['+0,22 м дальности','+12° к сектору удара'];
   if(bow)bonuses.push('+0,7 м дальности лука');
   return{art:ranged?'area-ranged':'area-melee',name,bonuses};
  }
  case'pierce':{
   if(character!=='shelly'&&!ranged)return{art:'knockback',name,bonuses:bow?['+0,25 м отбрасывания','Стрелы: ещё 1 цель']:['+0,25 м отбрасывания']};
   const bonuses=['Пробивает ещё 1 цель'];
   const falloff=character==='steve'?finite(weapon.penetrationFalloff,1):1;
   if(falloff<1)bonuses.push(`−${Math.round((1-falloff)*100)}% урона за пробитие`);
   return{art:'pierce',name,bonuses};
  }
  case'ricochet':{
   if(character==='shelly'||ranged)return{art:'ricochet',name,bonuses:['+1 рикошет снаряда']};
   const next=Math.min(definition.max,finite(weapon.ricochet,finite(state?.upgrades?.ricochet))+1);
   const bonuses=[`Повторный удар: ${Math.round((.20+next*.15)*100)}% урона`];
   if(bow)bonuses.push('+1 рикошет стрел');
   return{art:'ricochet',name,bonuses};
  }
  case'burn':return{art:'burn',name,bonuses:[character==='pudge'?'Рана на 3 с':'Поджог на 3 с',`${4+(finite(weapon.burn)+1)*4} урона/с`]};
  case'speed':return{art:'speed',name,bonuses:['+9% скорости']};
  case'maxhp':return{art:'maxhp',name,bonuses:['+25 макс. здоровья','Лечение до 30 здоровья']};
  case'regen':return{art:'regen',name,bonuses:['+0,65 здоровья/с']};
  case'pickup':return{art:'pickup',name,bonuses:['+1 м притяжения опыта','+8% опыта']};
  case'rot':{
   const next=Math.min(definition.max,finite(state?.upgrades?.rot)+1);
   return{art:'burn',name,bonuses:[`${12+(next-1)*4} урона/с вокруг`,`Радиус ${number(2.3+(next-1)*.2)} м`,'Враги на 20% медленнее']};
  }
  default:return{art:'damage-melee',name,bonuses:[]};
 }
}
