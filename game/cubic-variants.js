// Base enemy types keep the shared movement/attack rules; variants add an
// identifiable Minecraft creature, bounded stats and one clearly timed effect.
export const CUBIC_VARIANTS=Object.freeze({
  husk:Object.freeze({type:'walker',name:'Кадавр',minBosses:1,hp:1.6,speed:.82,damage:1.25,radius:1,xp:5}),
  stray:Object.freeze({type:'spitter',name:'Зимогор',minBosses:2,hp:1.2,speed:.95,damage:1.1,radius:1,xp:7,effect:'slow'}),
  'cave-spider':Object.freeze({type:'runner',name:'Пещерный паук',minBosses:2,hp:.95,speed:1.1,damage:.9,radius:.72,xp:5,effect:'poison'}),
  drowned:Object.freeze({type:'walker',name:'Утопленник',minBosses:1,hp:1.3,speed:1.14,damage:1.2,radius:1,xp:5}),
  'armored-zombie':Object.freeze({type:'walker',name:'Латник разлома',minBosses:3,hp:2.1,speed:.77,damage:1.35,radius:1.08,xp:8}),
  'armored-skeleton':Object.freeze({type:'spitter',name:'Костяной рыцарь',minBosses:3,hp:1.8,speed:.9,damage:1.3,radius:1.05,xp:10}),
  "zombie-villager":Object.freeze({"type":"walker","name":"Зомби-житель",minBosses:3,"hp":1.25,"speed":0.94,"damage":1.1,"radius":1,"xp":6}),
  "slime":Object.freeze({"type":"runner","name":"Слизень",minBosses:3,"hp":1.8,"speed":0.66,"damage":1,"radius":1.6,"xp":6,"split":true}),
  "silverfish":Object.freeze({"type":"runner","name":"Чешуйница",minBosses:4,"hp":0.48,"speed":1.12,"damage":0.65,"radius":0.5,"xp":3}),
  "pillager":Object.freeze({"type":"spitter","name":"Разбойник",minBosses:4,"hp":1.3,"speed":0.94,"damage":1,"radius":1,"xp":8,"projectile":"arrow","shotDamage":12,"shotInterval":3.2}),
  "wither-skeleton":Object.freeze({"type":"walker","name":"Скелет-иссушитель",minBosses:4,"hp":1.65,"speed":1.2,"damage":1.35,"radius":1.05,"xp":9}),
  "witch":Object.freeze({"type":"spitter","name":"Ведьма",minBosses:5,"hp":1.55,"speed":0.85,"damage":1,"radius":1,"xp":10,"projectile":"potion","shotDamage":6,"shotInterval":4,"effect":"poison","colour":"#bb7cfa"}),
  "bogged":Object.freeze({"type":"spitter","name":"Болотник",minBosses:5,"hp":1.15,"speed":0.9,"damage":1,"radius":1,"xp":8,"projectile":"arrow","shotDamage":8,"shotInterval":3.5,"effect":"poison","colour":"#a6df75"}),
  "endermite":Object.freeze({"type":"runner","name":"Эндермит",minBosses:5,"hp":0.65,"speed":1.12,"damage":0.8,"radius":0.55,"xp":4}),
  "magma-cube":Object.freeze({"type":"runner","name":"Магмовый куб",minBosses:6,"hp":2,"speed":0.65,"damage":1.25,"radius":1.6,"xp":7,"split":true}),
  "vindicator":Object.freeze({"type":"walker","name":"Поборник",minBosses:6,"hp":1.8,"speed":1.18,"damage":1.55,"radius":1,"xp":10}),
  "blaze":Object.freeze({"type":"spitter","name":"Ифрит",minBosses:6,"hp":1.35,"speed":1.04,"damage":1,"radius":1,"xp":10,"flying":true,"projectile":"fireball","shotDamage":7,"shotCount":3,"shotInterval":4.2,"colour":"#ffb45a"}),
  "guardian":Object.freeze({"type":"spitter","name":"Страж",minBosses:7,"hp":1.8,"speed":0.74,"damage":1,"radius":1.15,"xp":11,"flying":true,"spell":"guardian","shotInterval":4.8}),
  "zombified-piglin":Object.freeze({"type":"walker","name":"Зомбифицированный пиглин",minBosses:7,"hp":1.6,"speed":1.04,"damage":1.25,"radius":1,"xp":9}),
  "hoglin":Object.freeze({"type":"walker","name":"Хоглин",minBosses:7,"hp":2.35,"speed":1.08,"damage":1.4,"radius":1.55,"xp":13,"charge":true}),
  "phantom":Object.freeze({"type":"runner","name":"Фантом",minBosses:8,"hp":1.1,"speed":1.15,"damage":1.1,"radius":1.15,"xp":9,"flying":true}),
  "breeze":Object.freeze({"type":"spitter","name":"Вихрь",minBosses:8,"hp":1.4,"speed":1.15,"damage":1,"radius":1,"xp":11,"flying":true,"projectile":"wind","shotDamage":7,"shotInterval":3.8,"knockback":1.2,"colour":"#b8eaff"}),
  "piglin":Object.freeze({"type":"spitter","name":"Пиглин",minBosses:8,"hp":1.4,"speed":1.12,"damage":1.2,"radius":1,"xp":10,"projectile":"arrow","shotDamage":12,"shotInterval":3.2}),
  "enderman":Object.freeze({"type":"walker","name":"Эндермен",minBosses:9,"hp":2.2,"speed":1.15,"damage":1.4,"radius":1,"xp":14,"teleport":true}),
  "shulker":Object.freeze({"type":"spitter","name":"Шалкер",minBosses:9,"hp":2.2,"speed":0.3,"damage":1,"radius":1,"xp":13,"projectile":"shulker-bullet","shotDamage":8,"shotInterval":4,"effect":"slow","flying":true,"colour":"#dbb4ed"}),
  "zoglin":Object.freeze({"type":"walker","name":"Зоглин",minBosses:9,"hp":2.5,"speed":1.12,"damage":1.5,"radius":1.55,"xp":14,"charge":true}),
  "vex":Object.freeze({"type":"runner","name":"Досаждатель",minBosses:10,"hp":0.85,"speed":1.17,"damage":1.1,"radius":0.65,"xp":8,"flying":true}),
  "evoker":Object.freeze({"type":"spitter","name":"Вызыватель",minBosses:10,"hp":1.5,"speed":0.85,"damage":1,"radius":1,"xp":15,"spell":"fangs","shotInterval":5.5}),
  "piglin-brute":Object.freeze({"type":"walker","name":"Брутальный пиглин",minBosses:10,"hp":2.65,"speed":1.08,"damage":1.65,"radius":1.05,"xp":16}),
  "ghast":Object.freeze({"type":"spitter","name":"Гаст",minBosses:11,"hp":1.7,"speed":0.58,"damage":1,"radius":1.65,"xp":15,"flying":true,"projectile":"fireball","shotDamage":13,"shotInterval":5,"colour":"#ff906b"}),
  "ravager":Object.freeze({"type":"walker","name":"Разоритель",minBosses:11,"hp":3.2,"speed":0.84,"damage":1.65,"radius":1.8,"xp":18,"charge":true}),
  "creaking":Object.freeze({"type":"walker","name":"Скрипун",minBosses:12,"hp":2.5,"speed":1.06,"damage":1.3,"radius":1.1,"xp":15}),
});

export const CUBIC_DEBUFFS=Object.freeze({
  slow:Object.freeze({duration:2.5,strength:.2}),
  poison:Object.freeze({duration:3,damagePerSecond:2}),
});

/** Boss victories unlock families. Elapsed time alone never introduces a species. */
export function chooseCubicVariant(type,bosses,roll,activeVariants=[]){
  let available=Object.entries(CUBIC_VARIANTS).filter(([,definition])=>definition.type===type&&definition.minBosses<=bosses);
  if(bosses<1||!available.length)return null;
  const chance=Math.min(.6,.30+Math.max(0,bosses-1)*.05);
  if(!Number.isFinite(roll)||roll<0||roll>=chance)return null;
  if(bosses>=4&&available.length>4){
    // Keep a changing recent trio plus one rotating legacy species, rather
    // than turning every late horde into dozens of simultaneous model pools.
    const recent=available.slice(-3),older=available.slice(0,-3);
    available=[older[Math.floor(bosses/2)%older.length],...recent];
  }
  const active=new Set(activeVariants);
  if(active.size>=8)available=available.filter(([id])=>active.has(id));
  if(!available.length)return null;
  if(bosses<4)return available[Math.min(available.length-1,Math.floor(roll/chance*available.length))][0];
  // Recent arrivals get extra weight, while old families remain possible.
  const weights=available.map(([,d])=>Math.max(1,5-Math.floor((bosses-d.minBosses)/2)));
  let cursor=roll/chance*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<available.length;i++){cursor-=weights[i];if(cursor<0)return available[i][0];}
  return available.at(-1)[0];
}
