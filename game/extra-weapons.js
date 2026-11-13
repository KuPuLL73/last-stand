// Distinct additional roles; the central economy owns their final prices.
export const EXTRA_WEAPONS=Object.freeze([
 Object.freeze({id:'snow-caster',name:'Морозные снежки',kind:'snowball',price:0,damage:12,interval:.46,range:8.5,arc:0,knockback:.18,attackMode:'ranged',rangedKind:'snowball',projectileSpeed:18,projectileRadius:.15,effect:'slow',slowDuration:1.25,slowStrength:.28,description:'Быстрые снежки замедляют врага на 28% на 1,25 с. Контроль вместо высокого урона.'}),
 Object.freeze({id:'tide-trident',name:'Метательный трезубец',kind:'throwing-trident',price:0,damage:46,interval:1.5,range:11.5,arc:0,knockback:.65,pierce:1,penetrationFalloff:.7,attackMode:'ranged',rangedKind:'trident',projectileSpeed:23,projectileRadius:.12,description:'Дальний бросок пробивает две цели: вторая получает 70% урона. Сильный удар, затем восстановление.'}),
]);
