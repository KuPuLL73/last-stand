import {icon} from './survival-icons.js';
import {STEVE_WEAPONS,getSteveWeapon,STEVE_START_WEAPON} from './steve-weapons.js';
import {steveWeaponIcon} from './steve-weapon-icons.js';
import {STEVE_SKILLS,STEVE_START_SKILL,getSteveSkill} from './steve-skills.js';
import {steveSkillIcon} from './steve-skill-icons.js';
import {AURA_PRICES,ACHIEVEMENT_REWARDS,runReward} from './economy.js';
import {BOOSTS} from './boost-models.js';
import {boostIcon} from './boost-icons.js';
import {getUpgradeDefs} from './survival-core.js';
import {getUpgradeCombination} from './upgrade-combinations.js';
import {upgradeArtIcon} from './upgrade-art.js';
import stevePortraitURL from './assets/steve-portrait.svg?url';
import shellyPortraitURL from '../shelly/reference/shelly-official-render.png?url';
import pixelIcons from './assets/lobby-pixel/icons.json';
import badgeFirst from './assets/interface/badge-first.png?url';
import badgeHunter from './assets/interface/badge-hunter.png?url';
import badgeSurvivor from './assets/interface/badge-survivor.png?url';
import badgeWinner from './assets/interface/badge-winner.png?url';
import cubicArt from './assets/lobby-pixel/map-cubic.webp?url';
import frontierArt from './assets/lobby-pixel/map-frontier.webp?url';

const profileKey='rift-survival-profile.v1';
export const COSMETICS=[
 {id:'teal',name:'Бирюзовый импульс',color:'#80e3dd',wash:'#80e3dd33',price:0},
 {id:'amber',name:'Янтарный разлом',color:'#ffd078',wash:'#ffd07833',price:AURA_PRICES.amber},
 {id:'violet',name:'Фиолетовая искра',color:'#c398ff',wash:'#c398ff33',price:AURA_PRICES.violet},
];
const heroNames={steve:'Стив',shelly:'Шелли'},modeNames={campaign:'Кампания',endless:'Соло'},mapNames={cubic:'Кубический лес',frontier:'Пограничье'};
const achievementBadges={first:badgeFirst,hunter:badgeHunter,survivor:badgeSurvivor,winner:badgeWinner};
const volumeLevel=(value,fallback)=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):fallback;
const time=n=>{n=Math.max(0,Math.floor(Number(n)||0));return`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
export const shardAmount=n=>`${n} ${n%100>=11&&n%100<=14?'осколков':n%10===1?'осколок':n%10>=2&&n%10<=4?'осколка':'осколков'}`;
export function lobbyIcon(name){const data=pixelIcons.icons[name]||pixelIcons.icons.skull;return `<svg class="pixel-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true" focusable="false">${data.body}</svg>`;}
export function mapIllustration(map){return `<img src="${map==='frontier'?frontierArt:cubicArt}" alt="" loading="lazy" decoding="async">`;}
function initialProfile(){return{wallet:0,owned:['teal'],equipped:'teal',runs:[],claims:[],effects:true,musicVolume:.32,sfxVolume:1,ownedWeapons:[STEVE_START_WEAPON],weapon:STEVE_START_WEAPON,ownedSkills:[STEVE_START_SKILL],skill:STEVE_START_SKILL};}
function loadProfile(){try{const p={...initialProfile(),...JSON.parse(localStorage.getItem(profileKey)||'{}')};p.wallet=Number.isFinite(p.wallet)?Math.max(0,Math.floor(p.wallet)):0;p.owned=Array.isArray(p.owned)?[...new Set(['teal',...p.owned.filter(id=>COSMETICS.some(c=>c.id===id))])]:['teal'];p.equipped=p.owned.includes(p.equipped)?p.equipped:'teal';p.runs=Array.isArray(p.runs)?p.runs.filter(r=>Number.isFinite(r.kills)&&Number.isFinite(r.time)).slice(-30):[];p.claims=Array.isArray(p.claims)?p.claims:[];p.musicVolume=volumeLevel(p.musicVolume,.32);p.sfxVolume=volumeLevel(p.sfxVolume,1);p.ownedWeapons=[...new Set([STEVE_START_WEAPON,...(Array.isArray(p.ownedWeapons)?p.ownedWeapons:[]).filter(id=>STEVE_WEAPONS.some(w=>w.id===id))])];p.weapon=p.ownedWeapons.includes(p.weapon)?p.weapon:STEVE_START_WEAPON;p.ownedSkills=[...new Set([STEVE_START_SKILL,...(Array.isArray(p.ownedSkills)?p.ownedSkills:[]).filter(id=>STEVE_SKILLS.some(skill=>skill.id===id))])];p.skill=p.ownedSkills.includes(p.skill)?p.skill:STEVE_START_SKILL;return p;}catch{return initialProfile();}}

export class Lobby{
 constructor({getState,getRecord,getCharacter,getMap,onCharacter,onMap,onLaunch,onSound,isSoundEnabled,onCosmetic,onWeapon=()=>{},onSkill=()=>{},onVolumeChange=()=>{}}){
  Object.assign(this,{getState,getRecord,getCharacter,getMap,onCharacter,onMap,onLaunch,onSound,isSoundEnabled,onCosmetic,onWeapon,onSkill,onVolumeChange});this.profile=loadProfile();this.mode='campaign';this.shopTab='weapons';this.panel=document.querySelector('#lobby-panel');this.content=document.querySelector('#panel-content');this.currentPanel='';
  this.onVolumeChange({music:this.profile.musicVolume,sfx:this.profile.sfxVolume});
  this.onSkill(this.profile.skill);
  for(const id of ['shop','inventory','leaderboard','achievements'])document.querySelector('#nav-'+id+'-icon').innerHTML=lobbyIcon(id);
  document.querySelector('#wallet-icon').innerHTML=lobbyIcon('gems');document.querySelector('#change-hero .swap-label').innerHTML=lobbyIcon('swap');document.querySelector('#menu-help').innerHTML=lobbyIcon('help');document.querySelector('#menu-settings').innerHTML=lobbyIcon('settings');document.querySelector('#panel-close').innerHTML=lobbyIcon('close');document.querySelector('#start>b').innerHTML=lobbyIcon('play');
  document.querySelectorAll('.lobby-nav [data-panel]').forEach(b=>b.addEventListener('click',()=>this.open(b.dataset.panel)));
  document.querySelector('#change-hero').addEventListener('click',()=>this.open('inventory'));document.querySelector('#menu-settings').addEventListener('click',()=>this.open('settings'));document.querySelector('#panel-close').addEventListener('click',()=>this.close());document.querySelector('#menu-help').addEventListener('click',()=>this.open('help'));document.querySelector('#menu-sound').addEventListener('click',()=>{onSound();this.refresh();});
  this.panel.addEventListener('click',e=>{if(e.target===this.panel){const r=this.panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.close();}});
  this.content.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.shopTab){this.selectShopTab(b.dataset.shopTab);return;}
   if(b.dataset.mode){this.mode=b.dataset.mode;this.render();}
   if(b.dataset.map){onMap(b.dataset.map);this.render();}
   if(b.dataset.selectHero){onCharacter(b.dataset.selectHero);this.render();}
   if(b.dataset.buy){this.buy(b.dataset.buy);}
   if(b.dataset.buyWeapon){this.buyWeapon(b.dataset.buyWeapon);}
   if(b.dataset.buySkill){this.buySkill(b.dataset.buySkill);}
   if(b.dataset.selectSkill){this.selectSkill(b.dataset.selectSkill);}
   if(b.dataset.skillShop){this.shopTab='skills';this.open('shop');return;}
   if(b.dataset.toggle==='sound'){onSound();this.render();}
   if(b.dataset.toggle==='effects'){this.profile.effects=this.profile.effects===false;this.persist();this.render();}
   if(b.dataset.open==='help')this.open('help');
   if(b.dataset.claim){this.claim(b.dataset.claim);}
   if(b.id==='launch-run'){this.close();onLaunch(this.mode);}
  });
  this.content.addEventListener('input',e=>{
   const input=e.target.closest('input[data-volume]');if(!input||!['music','sfx'].includes(input.dataset.volume))return;
   const number=Number(input.value);if(!Number.isFinite(number))return;
   const value=Math.min(100,Math.max(0,number)),key=input.dataset.volume==='music'?'musicVolume':'sfxVolume';
   this.profile[key]=value/100;input.setAttribute('aria-valuetext',`${value}%`);
   const output=this.content.querySelector(`output[for="${input.id}"]`);if(output)output.value=`${value}%`;
   this.persist();this.onVolumeChange({music:this.profile.musicVolume,sfx:this.profile.sfxVolume});
  });
  this.content.addEventListener('keydown',e=>{
   const tab=e.target.closest('[data-shop-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const ids=['weapons','auras','skills'];this.selectShopTab(e.key==='Home'?ids[0]:e.key==='End'?ids.at(-1):ids[(ids.indexOf(tab.dataset.shopTab)+(e.key==='ArrowLeft'?-1:1)+ids.length)%ids.length]);
  });
  this.profileStorageListener=event=>{if(event.storageArea!==localStorage||event.key!==profileKey)return;this.profile=loadProfile();this.refresh();if(this.panel.open&&this.currentPanel)this.render();};
  window.addEventListener('storage',this.profileStorageListener);
  this.refresh();onCosmetic(this.cosmetic.color);
 }
 get cosmetic(){return COSMETICS.find(c=>c.id===this.profile.equipped)||COSMETICS[0];}
 getSkill(){return getSteveSkill(this.profile.skill);}
 selectSkill(id){if(!this.profile.ownedSkills.includes(id)||!STEVE_SKILLS.some(skill=>skill.id===id)||this.getCharacter()!=='steve')return false;this.profile.skill=id;this.persist();this.onSkill(id);this.render();return true;}
 buySkill(id){const skill=STEVE_SKILLS.find(item=>item.id===id);if(!skill)return false;const owned=this.profile.ownedSkills.includes(id);if(!owned&&this.profile.wallet<skill.price)return false;if(!owned){this.profile.wallet-=skill.price;this.profile.ownedSkills.push(id);}this.profile.skill=id;this.persist();this.onSkill(id);this.render();this.toast(`${skill.name} · выбран для Стива`);return true;}
 persist(){try{localStorage.setItem(profileKey,JSON.stringify(this.profile));}catch{}this.refresh();}
 refresh(){document.querySelector('#wallet-value').textContent=this.profile.wallet.toLocaleString('ru-RU');document.querySelector('#menu-sound').setAttribute('aria-pressed',String(this.isSoundEnabled()));document.querySelector('#menu-sound').innerHTML=lobbyIcon(this.isSoundEnabled()?'music':'music-off');document.body.dataset.menuMotion=String(this.profile.effects!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches);const r=this.getRecord();document.querySelector('#lobby-best-kills').textContent=r.kills||0;document.querySelector('#achievement-dot').hidden=!this.achievements().some(a=>a.done&&!this.profile.claims.includes(a.id));}
 open(type){if(this.currentPanel!==type){this.panel.scrollTop=0;this.content.scrollTop=0;}this.currentPanel=type;this.render();if(!this.panel.open)this.panel.showModal();}
 close(){this.panel.close();this.currentPanel='';}
 toast(text){clearTimeout(this.toastTimer);this.content.querySelector('.panel-toast')?.remove();const n=document.createElement('div');n.className='panel-toast';n.role='status';n.textContent=text;this.content.append(n);this.toastTimer=setTimeout(()=>n.remove(),2200);}
 render(){
  const scroll=this.content.scrollTop,outerScroll=this.panel.scrollTop;
  this.panel.dataset.panel=this.currentPanel;
  const titles={play:'Выбери режим',shop:'Магазин',inventory:'Инвентарь',leaderboard:'Рекорды',achievements:'Достижения',settings:'Настройки',help:'Как играть'};
  const eyebrow=document.querySelector('#panel-eyebrow');if(eyebrow)eyebrow.textContent='';
  document.querySelector('#panel-title').textContent=titles[this.currentPanel]||titles.play;
  this.content.innerHTML=this[this.currentPanel+'HTML']();
  this.panel.scrollTop=outerScroll;this.content.scrollTop=scroll;
 }
 selectShopTab(id){
  if(!['weapons','auras','skills'].includes(id))return;
  this.shopTab=id;this.panel.scrollTop=0;this.content.scrollTop=0;this.render();
  this.content.querySelector(`[data-shop-tab="${id}"]`)?.focus();
 }
 playHTML(){
  const map=this.getMap();
  return `<div class="mode-options">${[
   ['campaign','sword','Кампания','4 минуты и финальный босс'],
   ['endless','skull','Бесконечное соло','Волны, боссы, рекорды'],
  ].map(([id,art,name,description])=>`<button class="mode-option" data-mode="${id}" aria-pressed="${this.mode===id}"><span class="mode-icon">${lobbyIcon(art)}</span><div class="mode-copy"><b>${name}</b><small>${description}</small></div><i class="selection-mark" aria-hidden="true">${lobbyIcon('check')}</i></button>`).join('')}</div>
  <div id="map-picker" class="map-picker"><h3 class="picker-label">Где сражаемся?</h3><div class="map-options">${['cubic','frontier'].map(id=>`<button data-map="${id}" aria-pressed="${map===id}"><span class="map-illustration">${mapIllustration(id)}</span><div class="map-copy"><b>${mapNames[id]}</b><small>${id==='cubic'?'Зомби, скелеты, криперы':'Пустыня и заражённая орда'}</small></div></button>`).join('')}</div></div>
  <div class="launch-row"><button id="launch-run" class="panel-primary">${this.mode==='campaign'?'НАЧАТЬ КАМПАНИЮ':'НАЧАТЬ СОЛО'}<span aria-hidden="true">${lobbyIcon('play')}</span></button></div>`;
 }
 inventoryHTML(){
  const selected=this.getCharacter(),steve=selected==='steve',weapon=getSteveWeapon(this.profile.weapon),skill=this.getSkill();
  return `<h3 class="panel-subtitle">Герой</h3><div class="inventory-heroes">${['steve','shelly'].map(id=>`<article class="inventory-hero ${id===selected?'selected':''}"><header><img src="${id==='steve'?stevePortraitURL:shellyPortraitURL}" class="${id==='steve'?'steve-portrait':''}" alt="${heroNames[id]}"><div><h3>${heroNames[id]}</h3><small>${id==='steve'?'Мечи, луки и магия':'Стрелок · дальний бой'}</small></div></header><button class="panel-secondary" data-select-hero="${id}" ${id===selected?'disabled':''}>${id===selected?'ВЫБРАН':'ВЫБРАТЬ ГЕРОЯ'}</button></article>`).join('')}</div>
  <h3 class="panel-subtitle">Снаряжение · ${heroNames[selected]}</h3><div class="inventory-items"><div class="inventory-item"><span>${steve?steveWeaponIcon(weapon.id):icon('damage')}</span><div><b>${steve?weapon.name:'Дробовик'}</b><small>${steve?`${weapon.damage} урона · ${(1/weapon.interval).toFixed(2).replace('.',',')} ${weapon.attackMode==='ranged'?'выстр/с':'уд/с'} · ${weapon.range.toFixed(1).replace('.',',')} м`:'Автоогонь · 5 дробинок'}</small></div></div><div class="inventory-item"><span>${steve?steveSkillIcon(skill.id):icon('super')}</span><div><b>${steve?skill.name:'Супервыстрел'}</b><small>${steve?`Навык · ${skill.duration.toString().replace('.',',')} с`:'Способность · залп с отбрасыванием'}</small></div></div></div>
  ${steve?`<h3 class="panel-subtitle">Навык</h3><div class="skill-grid">${STEVE_SKILLS.map(option=>this.skillCard(option)).join('')}</div>`:''}
  <h3 class="panel-subtitle">Ауры · ${this.profile.owned.length}/${COSMETICS.length}</h3><div class="shop-grid">${this.profile.owned.map(id=>this.cosmeticCard(COSMETICS.find(c=>c.id===id))).join('')}</div>`;
 }
 cosmeticCard(c){
  const owned=this.profile.owned.includes(c.id),equipped=this.profile.equipped===c.id;
  return `<article class="shop-item ${equipped?'equipped':''}" style="--cosmetic:${c.color};--cosmetic-wash:${c.wash}"><div class="cosmetic-art" style="color:${c.color}">${lobbyIcon('sparkle')}</div><h3>${c.name}</h3><button class="panel-secondary" data-buy="${c.id}" aria-label="${equipped?`${c.name}: выбрано`:owned?`Надеть: ${c.name}`:`Купить: ${c.name}, ${shardAmount(c.price)}`}" ${equipped?'disabled':''}>${equipped?'ВЫБРАНО':owned?'НАДЕТЬ':`<span class="item-price">${c.price} ${lobbyIcon('gems')}</span>`}</button></article>`;
 }
 skillCard(skill,{shop=false}={}){
  const owned=this.profile.ownedSkills.includes(skill.id),equipped=this.profile.skill===skill.id,affordable=this.profile.wallet>=skill.price;
  const action=shop?`data-buy-skill="${skill.id}"`:owned?`data-select-skill="${skill.id}"`:'data-skill-shop="skills"';
  const label=equipped?'ВЫБРАН':owned?'ВЫБРАТЬ':shop?`<span class="item-price">${skill.price} ${lobbyIcon('gems')}</span>`:'В МАГАЗИН';
  const accessible=equipped?`${skill.name}: выбран`:owned?`Выбрать навык: ${skill.name}`:shop?`Купить навык: ${skill.name}, ${shardAmount(skill.price)}`:`Открыть магазин: ${skill.name}, ${shardAmount(skill.price)}`;
  return `<article class="skill-card ${equipped?'selected':''} ${owned?'owned':'locked'}" data-skill="${skill.id}"><span class="skill-art">${steveSkillIcon(skill.id)}</span><div class="skill-copy"><h3>${skill.name}</h3><p>${skill.description}</p>${!owned&&!shop?`<span class="skill-price">${skill.price} ${lobbyIcon('gems')}</span>`:''}</div><button class="panel-secondary" ${action} aria-label="${accessible}" ${owned?`aria-pressed="${equipped}"`:''} ${equipped||(!owned&&shop&&!affordable)?'disabled':''}>${label}</button></article>`;
 }
 weaponCard(w){
  const owned=this.profile.ownedWeapons.includes(w.id),equipped=this.profile.weapon===w.id,affordable=this.profile.wallet>=w.price;
  return `<article class="weapon-card ${equipped?'equipped':''}" data-weapon="${w.id}" title="${w.description}"><div class="weapon-overview"><div class="weapon-art">${steveWeaponIcon(w.id)}</div><div class="weapon-copy"><h3>${w.name}</h3>${w.attackMode==='ranged'?`<small class="weapon-kind">Дальний бой</small>`:''}<div class="weapon-stats"><span><small>Урон</small><b>${w.damage}</b></span><span><small>${w.attackMode==='ranged'?'Выстр/с':'Уд/с'}</small><b>${(1/w.interval).toFixed(2).replace('.',',')}</b></span><span><small>Метры</small><b>${w.range.toFixed(1).replace('.',',')}</b></span></div></div></div><button class="panel-secondary" data-buy-weapon="${w.id}" aria-label="${equipped?`${w.name}: выбрано`:owned?`Взять в бой: ${w.name}`:`Купить: ${w.name}, ${shardAmount(w.price)}`}" ${equipped||(!owned&&!affordable)?'disabled':''}>${equipped?'ВЫБРАНО':owned?'ВЗЯТЬ В БОЙ':`<span class="item-price">${w.price} ${lobbyIcon('gems')}</span>`}</button></article>`;
 }
 shopHTML(){
  const weapons=this.shopTab==='weapons',skills=this.shopTab==='skills';
  return `<nav class="shop-tabs" role="tablist" aria-label="Раздел магазина">${[['weapons','Оружие'],['auras','Ауры'],['skills','Навыки']].map(([id,name])=>`<button class="panel-secondary" id="shop-tab-${id}" data-shop-tab="${id}" role="tab" aria-selected="${this.shopTab===id}" aria-controls="shop-section" tabindex="${this.shopTab===id?0:-1}">${name}</button>`).join('')}</nav><div class="shop-section" id="shop-section" role="tabpanel" aria-labelledby="shop-tab-${this.shopTab}">${weapons?`<div class="weapon-grid" aria-label="Оружие Стива">${STEVE_WEAPONS.map(w=>this.weaponCard(w)).join('')}</div>`:skills?`<div class="skill-grid" aria-label="Навыки Стива">${STEVE_SKILLS.map(skill=>this.skillCard(skill,{shop:true})).join('')}</div>`:`<div class="shop-grid" aria-label="Ауры героя">${COSMETICS.map(c=>this.cosmeticCard(c)).join('')}</div>`}</div>`;
 }
 buyWeapon(id){const w=STEVE_WEAPONS.find(item=>item.id===id);if(!w)return false;const owned=this.profile.ownedWeapons.includes(id);if(!owned&&this.profile.wallet<w.price)return false;if(!owned){this.profile.wallet-=w.price;this.profile.ownedWeapons.push(id);}this.profile.weapon=id;this.persist();this.onWeapon(id);this.render();this.toast(`${w.name} · выбрано для Стива`);return true;}

 buy(id){const c=COSMETICS.find(c=>c.id===id);if(!c)return;if(!this.profile.owned.includes(id)){if(this.profile.wallet<c.price){this.toast(`Нужно ещё ${shardAmount(c.price-this.profile.wallet)}. Их можно заработать в забегах и достижениях.`);return;}this.profile.wallet-=c.price;this.profile.owned.push(id);}this.profile.equipped=id;this.persist();this.onCosmetic(c.color);this.render();this.toast(`${c.name} · надето`);}
 leaderboardHTML(){
  const runs=[...this.profile.runs].sort((a,b)=>b.kills-a.kills||b.time-a.time).slice(0,10);
  return `<span class="local-badge">На этом устройстве</span>${runs.length?`<table class="leaderboard-table"><thead><tr><th scope="col">№</th><th scope="col">Герой / режим</th><th scope="col">Враги</th><th scope="col">Время</th><th scope="col">Боссы</th></tr></thead><tbody>${runs.map((r,i)=>`<tr class="rank-${i+1}"><td><span class="leader-rank">${i<3?lobbyIcon('crown'):''}<b>${String(i+1).padStart(2,'0')}</b></span></td><td><div class="leader-hero"><img src="${r.hero==='steve'?stevePortraitURL:shellyPortraitURL}" class="${r.hero==='steve'?'steve-portrait':''}" alt=""><div><b>${heroNames[r.hero]||'Герой'} · ${modeNames[r.mode]||'Кампания'}</b><small>${mapNames[r.map]||'Арена'} · ${r.won?'Победа':'Забег завершён'}</small></div></div></td><td data-label="Враги">${Math.floor(r.kills)}</td><td data-label="Время">${time(r.time)}</td><td data-label="Боссы">${Math.max(0,Math.floor(Number(r.bosses)||0))}</td></tr>`).join('')}</tbody></table>`:`<div class="panel-empty"><span>${lobbyIcon('leaderboard')}</span><b>Рекордов пока нет</b><p>Заверши забег.</p></div>`}`;
 }
 achievements(){const r=this.getRecord(),count=this.profile.runs.length;return[
  {id:'first',name:'Первый шаг',description:'Заверши первый забег',progress:count,target:1,reward:ACHIEVEMENT_REWARDS.first,art:'crest'},
  {id:'hunter',name:'Охотник на орду',description:'Победи 50 врагов за один забег',progress:r.kills||0,target:50,reward:ACHIEVEMENT_REWARDS.hunter,art:'inventory'},
  {id:'survivor',name:'Никогда не сдавайся',description:'Продержись 3 минуты',progress:r.time||0,target:180,reward:ACHIEVEMENT_REWARDS.survivor,art:'achievements'},
  {id:'winner',name:'Первый рубеж',description:'Победи босса в кампании',progress:r.wins||0,target:1,reward:ACHIEVEMENT_REWARDS.winner,art:'leaderboard'},
 ].map(a=>({...a,done:a.progress>=a.target}));}
 achievementsHTML(){
  return `<div class="achievement-list">${this.achievements().map(a=>{const claimed=this.profile.claims.includes(a.id),progress=Math.min(a.target,Math.floor(a.progress));return `<article class="achievement-card ${claimed?'claimed':a.done?'complete':''}"><span class="achievement-art"><img src="${achievementBadges[a.id]}" alt="" width="96" height="96"></span><div class="achievement-copy"><h3>${a.name}</h3><p>${a.description} · ${progress}/${a.target}</p><div class="achievement-track" role="progressbar" aria-label="${a.name}" aria-valuemin="0" aria-valuemax="${a.target}" aria-valuenow="${progress}"><i style="width:${Math.min(100,a.progress/a.target*100)}%"></i></div></div><button class="panel-secondary" data-claim="${a.id}" aria-label="${claimed?`${a.name}: награда получена`:a.done?`Получить ${shardAmount(a.reward)}: ${a.name}`:`Награда за ${a.name}: ${shardAmount(a.reward)}`}" ${!a.done||claimed?'disabled':''}>${claimed?'ПОЛУЧЕНО':a.done?`ПОЛУЧИТЬ <span class="item-price">+${a.reward} ${lobbyIcon('gems')}</span>`:`<span class="item-price">+${a.reward} ${lobbyIcon('gems')}</span>`}</button></article>`;}).join('')}</div>`;
 }
 claim(id){const a=this.achievements().find(a=>a.id===id);if(!a?.done||this.profile.claims.includes(id))return;this.profile.claims.push(id);this.profile.wallet+=a.reward;this.persist();this.render();this.toast(`+${a.reward} осколков · ${a.name}`);}
 settingsHTML(){
  const sliders=[['music','Музыка','Громкость музыки',this.profile.musicVolume],['sfx','Эффекты звука','Громкость эффектов звука',this.profile.sfxVolume]];
  return `<div class="settings-list"><div><span>${lobbyIcon('music')}</span><b>Звук</b><button class="panel-secondary" data-toggle="sound" aria-pressed="${this.isSoundEnabled()}" aria-label="Звук: ${this.isSoundEnabled()?'включён':'выключен'}">${this.isSoundEnabled()?'ВКЛ':'ВЫКЛ'}</button></div>${sliders.map(([id,label,accessible,value])=>{const percent=Math.round(value*100),inputId=`setting-${id}-volume`;return `<div class="volume-setting"><label for="${inputId}">${label}</label><output class="volume-value" id="${inputId}-value" for="${inputId}">${percent}%</output><input type="range" id="${inputId}" data-volume="${id}" min="0" max="100" step="1" value="${percent}" aria-label="${accessible}" aria-valuetext="${percent}%"></div>`;}).join('')}<div><span>${lobbyIcon('sparkle')}</span><b>Эффекты мира</b><button class="panel-secondary" data-toggle="effects" aria-pressed="${this.profile.effects!==false}" aria-label="Эффекты мира: ${this.profile.effects!==false?'включены':'выключены'}">${this.profile.effects!==false?'ВКЛ':'ВЫКЛ'}</button></div><button class="panel-secondary" data-open="help">Как играть</button></div>`;
 }
 helpHTML(){
  const steve=this.getCharacter()==='steve',weapon=getSteveWeapon(this.profile.weapon),skill=this.getSkill();
  const character=steve?'steve':'shelly',combo=getUpgradeCombination(character,weapon.id);
  const definitions=getUpgradeDefs(character,weapon.id);
  const recipe=combo.requirements.map(({id,rank})=>`${definitions.find(definition=>definition.id===id).name} ${rank}/${rank}`).join(' + ');
  return `<div class="help-grid" id="intro-features"><div><h3>Управление</h3><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> или стрелки.<br>На телефоне — джойстик.</p><p>Атака автоматическая. Собирай кристаллы опыта и выбирай улучшения.</p></div><div><h3 id="ability-guide-title">${steve?`${weapon.name} + ${skill.name.toLowerCase()}`:'Дробовик + супер'}</h3><p id="ability-guide">${steve?`${weapon.description} ${skill.description} Навык выбирается в инвентаре.`:'Супервыстрел наносит мощный залп и отбрасывает врагов.'}</p><p><kbd>ПРОБЕЛ</kbd> — способность.<br><kbd>Esc</kbd> — пауза.</p></div></div><div class="help-boosts combo-help"><h3>Комбинация</h3><div><span>${upgradeArtIcon(combo.art)}</span><div><b>${combo.name}</b><small>${recipe}</small><small>${combo.description} После обеих карточек выбери комбо при повышении уровня.</small></div></div></div><div class="help-boosts"><h3>Находки</h3>${Object.entries(BOOSTS).map(([id,boost])=>`<div><span>${boostIcon(id)}</span><div><b>${boost.name}</b><small>${boost.detail}</small></div></div>`).join('')}</div>`;
 }
 recordResult(s){const breakdown=runReward(s),{bosses,total:reward}=breakdown;this.lastReward=breakdown;this.profile.wallet+=reward;this.profile.runs.push({hero:s.character,map:s.map,mode:s.mode||'campaign',kills:s.kills,time:s.elapsed,bosses,reward,won:s.phase==='won',date:Date.now()});this.profile.runs=this.profile.runs.slice(-30);this.persist();return reward;}
}
