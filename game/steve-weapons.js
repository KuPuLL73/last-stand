import {EXTRA_WEAPONS} from './extra-weapons.js';
import {WEAPON_PRICES} from './economy.js';
// Permanent equipment for Steve. Run upgrades multiply these starting stats.
// Prices use the existing earned shards, with no second currency.
export const STEVE_WEAPONS=Object.freeze([
 {id:'wooden-sword',name:'Деревянный меч',kind:'sword',price:0,damage:24,interval:.80,range:2.45,arc:110,knockback:.50,description:'Первое оружие. Лёгкий широкий взмах.'},
 {id:'stone-sword',name:'Каменный меч',kind:'sword',price:60,damage:30,interval:.79,range:2.55,arc:118,knockback:.58,description:'Более тяжёлый клинок для первых боссов.'},
 {id:'stone-axe',name:'Каменный топор',kind:'axe',price:100,damage:44,interval:1.10,range:2.45,arc:115,knockback:.90,description:'Медленнее меча, сильнее отбрасывает.'},
 {id:'iron-sword',name:'Железный меч',kind:'sword',price:160,damage:36,interval:.76,range:2.65,arc:120,knockback:.65,description:'Универсальный клинок для долгого забега.'},
 {id:'golden-sword',name:'Золотой меч',kind:'sword',price:220,damage:32,interval:.58,range:2.50,arc:125,knockback:.48,description:'Быстрые взмахи с меньшим уроном за удар.'},
 {id:'iron-axe',name:'Железный топор',kind:'axe',price:360,damage:58,interval:1.08,range:2.55,arc:115,knockback:1.00,description:'Тяжёлый удар против плотной орды.'},
 {id:'diamond-sword',name:'Алмазный меч',kind:'sword',price:500,damage:44,interval:.72,range:2.75,arc:120,knockback:.72,description:'Высокий урон и хорошая дальность взмаха.'},
 {id:'diamond-axe',name:'Алмазный топор',kind:'axe',price:700,damage:70,interval:1.04,range:2.65,arc:118,knockback:1.12,description:'Сильный удар и уверенное отбрасывание.'},
 {id:'trident',name:'Трезубец',kind:'trident',price:800,damage:42,interval:.86,range:3.30,arc:70,knockback:.78,pierce:1,description:'Длинный узкий выпад. Ещё одна цель для стрелы.'},
 {id:'netherite-sword',name:'Незеритовый меч',kind:'sword',price:850,damage:50,interval:.76,range:2.80,arc:125,knockback:.90,description:'Тяжёлый клинок с широким сектором.'},
 {id:'mace',name:'Булава',kind:'mace',price:1000,damage:85,interval:1.40,range:2.50,arc:95,knockback:1.55,description:'Редкий мощный удар сверху. Сильно отбрасывает.'},
 {id:'netherite-axe',name:'Незеритовый топор',kind:'axe',price:1150,damage:78,interval:1.07,range:2.70,arc:120,knockback:1.25,description:'Тяжёлое оружие для поздних волн.'},
 {id:'hunting-bow',name:'Охотничий лук',kind:'bow',price:140,damage:22,interval:.75,range:9.8,arc:0,knockback:.28,attackMode:'ranged',rangedKind:'arrow',projectileSpeed:24,projectileRadius:.10,penetrationFalloff:.72,description:'Автоматические точные стрелы. Держи дистанцию.'},
 {id:'crossbow',name:'Арбалет',kind:'crossbow',price:380,damage:48,interval:1.80,range:10.8,arc:0,knockback:.75,pierce:1,attackMode:'ranged',rangedKind:'bolt',projectileSpeed:30,projectileRadius:.12,penetrationFalloff:.72,description:'Мощный болт пробивает две цели; после пробития теряет 28% урона.'},
 {id:'ember-staff',name:'Жезл ифрита',kind:'staff',price:650,damage:24,interval:1.20,range:8.5,arc:0,knockback:.18,burn:1,attackMode:'ranged',rangedKind:'ember',projectileSpeed:15,projectileRadius:.18,splashRadius:1.2,penetrationFalloff:.72,description:'Огненный сгусток обжигает небольшую группу врагов.'},
...EXTRA_WEAPONS].map(weapon=>Object.freeze({...weapon,price:WEAPON_PRICES[weapon.id]??weapon.price})));
export const getSteveWeapon=id=>STEVE_WEAPONS.find(weapon=>weapon.id===id)||STEVE_WEAPONS[0];
export const STEVE_START_WEAPON='wooden-sword';
export function weaponStats(id){const w=getSteveWeapon(id);return{id:w.id,type:w.kind,damage:w.damage,fireInterval:w.interval,range:w.range,arc:w.arc*Math.PI/180,knockback:w.knockback,pierce:w.pierce||0,burn:w.burn||0,attackMode:w.attackMode||'melee',rangedKind:w.rangedKind||null,projectileSpeed:w.projectileSpeed||24,projectileRadius:w.projectileRadius||.10,splashRadius:w.splashRadius||0,penetrationFalloff:w.penetrationFalloff??(w.attackMode==='ranged'?.72:1),effect:w.effect||null,slowDuration:w.slowDuration||0,slowStrength:w.slowStrength||0};}
