import {SKILL_PRICES} from './economy.js';
// Permanent skill unlocks use earned shards; activation uses the super meter.
export const STEVE_SKILLS=Object.freeze([
 Object.freeze({id:'bow',name:'Залп из лука',shortName:'ЛУК',price:0,description:'8 секунд дальнего боя. Стрелы пробивают и поджигают с улучшениями.',duration:8,cooldown:8}),
 Object.freeze({id:'dash',name:'Рассекающий рывок',shortName:'РЫВОК',price:220,description:'Рывок до 5 м с ударом по врагам на пути. Во время рывка герой защищён.',duration:.35,cooldown:1.2,distance:5}),
 Object.freeze({id:'bulwark',name:'Зеркальный щит',shortName:'ЩИТ',price:360,description:'4 секунды защиты. Возвращает вражеские снаряды отправителю.',duration:4,cooldown:4}),
].map(skill=>Object.freeze({...skill,price:SKILL_PRICES[skill.id]??skill.price})));
export const STEVE_START_SKILL='bow';
export const getSteveSkill=id=>STEVE_SKILLS.find(skill=>skill.id===id)||STEVE_SKILLS[0];
