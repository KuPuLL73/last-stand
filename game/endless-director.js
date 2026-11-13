// Shared balance data. All times refer to active simulation seconds.
export const BONUS_DROPS=Object.freeze({chance:.06,cooldown:8,maxActive:3});

export const ENDLESS_BOSSES=Object.freeze({
  'iron-golem':Object.freeze({name:'Заражённый голем',hp:1050,speed:.91,damage:20,radius:1.1,xp:35,hazard:'stone'}),
  wither:Object.freeze({name:'Визер',hp:1050,speed:1.05,damage:18,radius:.95,xp:35,hazard:'wither'}),
  warden:Object.freeze({name:'Хранитель',hp:1250,speed:.92,damage:22,radius:1.1,xp:45,hazard:'sonic'}),
  'ender-dragon':Object.freeze({name:'Дракон Края',hp:1550,speed:1.1,damage:22,radius:1.4,xp:65,hazard:'dragon'}),
  'zombie-brute':Object.freeze({name:'Зомби-качок',hp:1400,speed:1.05,damage:20,radius:1.05,xp:50,hazard:'charge'}),
  'elder-guardian':Object.freeze({name:'Древний страж',hp:1080,speed:.78,damage:17,radius:1.1,xp:45,hazard:'guardian'}),
});
export const ENDLESS_BOSS_ORDER=Object.freeze(['iron-golem','wither','warden','elder-guardian','zombie-brute','ender-dragon']);

/** Active time strengthens existing species; boss victories unlock new ones. */
export function endlessPressure(elapsed,bosses=0){
  const time=Math.min(1800,Math.max(0,Number.isFinite(elapsed)?elapsed:0));
  const cleared=Math.min(12,Math.max(0,Number.isFinite(bosses)?bosses:0));
  const opening=Math.min(1,time/45);
  return {
    tier:Math.min(6,1+Math.floor(time/120)+Math.floor(cleared/2)),
    hp:1+Math.min(4,time/240)+cleared*.24,
    damage:1+Math.min(.8,time/1400)+Math.min(.5,cleared*.06),
    speed:1+Math.min(.26,time/2400),
    spawnInterval:time<45?2.4-opening*1.35:Math.max(.42,1.05-(time-45)*.00075),
    extraSpawnChance:time<45?0:Math.min(.42,(time-45)/1500),
    maxAlive:time<45?8+Math.floor(opening*10):Math.min(60,18+Math.floor((time-45)/6)),
  };
}

export const endlessXpNeeded=level=>Math.round(9+6*(Math.max(1,level)-1)+2.5*Math.pow(Math.max(0,level-3),2));
