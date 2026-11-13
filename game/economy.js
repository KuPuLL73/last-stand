// Permanent unlocks: an early upgrade is attainable, specialist equipment is
// a deliberate saving goal. Test grants never enter these starting balances.
export const WEAPON_PRICES=Object.freeze({
 'wooden-sword':0,'stone-sword':300,'stone-axe':500,'iron-sword':1000,
 'golden-sword':1300,'iron-axe':1800,'diamond-sword':2600,'diamond-axe':3600,
 trident:3900,'netherite-sword':4600,mace:5600,'netherite-axe':6800,
 'hunting-bow':800,crossbow:2500,'ember-staff':3400,'snow-caster':1600,'tide-trident':4400,
});
export const SKILL_PRICES=Object.freeze({bow:0,dash:1100,bulwark:1700});
export const AURA_PRICES=Object.freeze({teal:0,amber:1200,violet:1800});
export const ACHIEVEMENT_REWARDS=Object.freeze({first:80,hunter:120,survivor:140,winner:260});
const count=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;

/** A completed run pays combat, earned active time and escalating boss wins.
 * Time is limited by real kills: waiting, menus and restart spam cannot farm it.
 * The caller settles once for all normal endings, including voluntary retire. */
export function runReward(state={}){
 const kills=count(state.kills),bosses=Math.min(10000,Math.max(count(state.stats?.bosses??state.bosses),state.phase==='won'?1:0));
 const elapsed=Number.isFinite(state.elapsed)?Math.max(0,state.elapsed):0;
 const combat=Math.floor(kills*.45);
 const earnedMinutes=Math.min(15,Math.floor(Math.min(elapsed,kills*4)/60));
 const survival=earnedMinutes*12;
 const rising=Math.min(5,bosses),boss=rising*90+15*rising*(rising-1)+Math.max(0,bosses-5)*210;
 return {combat,survival,boss,total:combat+survival+boss,earnedMinutes,bosses};
}
