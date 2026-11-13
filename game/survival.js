import './survival.css';
import './survival-icons.css';
import './survival-character.css';
import './pudge-ui.css';
import './lobby.css';
import './lobby-pixel.css';
import './boost-ui.css';
import './steve-weapons.css';
import './gameplay-hud.css';
import './interface-theme.css';
import './upgrade-cards.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import characterURL from '../shelly/game/shelly-game.glb?url';
import {createPlatform} from './platform.js';
import {ArenaSound} from './sound.js';
import {MusicDirector} from './music-director.js';
import {createDesertArena} from './desert-stage.js';
import {createCubicArena} from './cubic-stage.js';
import {SurvivalRun,getRunUpgradeDefs} from './survival-core.js';
import {SurvivalEnemies} from './survival-enemies.js';
import {BOOSTS} from './boost-models.js';
import {boostIcon} from './boost-icons.js';
import {CUBIC_VARIANTS} from './cubic-variants.js';
import {ENDLESS_BOSSES} from './endless-director.js';
import {getSteveWeapon} from './steve-weapons.js';
import {steveWeaponImage} from './steve-weapon-icons.js';
import {getSteveSkill} from './steve-skills.js';
import {steveSkillIcon} from './steve-skill-icons.js';
import bowIconURL from './assets/hud/bow.png?url';
import pauseIcon from './assets/hud/pause.svg?raw';
import {SurvivalEffects} from './survival-effects.js';
import {playCombatPixelFx,playStatusPixelFx} from './combat-pixel-fx.js';
import {icon} from './survival-icons.js';
import {createUpgradeCard,updateCombinationProgress} from './upgrade-cards.js';
import {upgradePresentation} from './upgrade-presentation.js';
import {upgradeArtIcon,upgradeImages} from './upgrade-art.js';
import {combinationRank,getUpgradeCombination,isCombinationUnlocked} from './upgrade-combinations.js';
import {ShotFeedback} from './survival-shot.js';
import {createSteve} from './steve-model.js';
import stevePortraitURL from './assets/steve-portrait.svg?url';
import shellyPortraitURL from '../shelly/reference/shelly-official-render.png?url';
import {loadPudge,pudgePortraitURL} from './pudge-model.js';
import {PudgeEffects} from './pudge-effects.js';
import {pudgeIcon} from './pudge-icons.js';
import {createMenuStage} from './menu-stage.js';
import {Lobby,shardAmount,lobbyIcon} from './lobby.js';

async function boot(){
 const $=selector=>document.querySelector(selector);
 const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
 document.body.classList.toggle('touch-mode',mobile);
 const platform=await createPlatform(),audio=new ArenaSound(),music=new MusicDirector();
 let renderDirty=true,menuFrameClock=0;
 let nextStatusPixels=0;
 let loaded=false,externalPause=platform.paused,renderedPhase='',previousBuild='',hudClock=0,stepClock=0;
 const keys=new Set(),movement={x:0,z:0};let superRequested=false,stickPointer=null;
 const recordsKey='shelly-survival-record.v1';let record={kills:0,time:0,wins:0};
 let selectedCharacter='steve';
 let selectedMap='cubic';
 try{record={...record,...JSON.parse(localStorage.getItem(recordsKey)||'{}')};audio.enabled=localStorage.getItem('shelly-range-sound')!=='off';}catch{}
 try{const saved=localStorage.getItem('survival-character');if(['shelly','steve'].includes(saved))selectedCharacter=saved;}catch{}
 try{const saved=localStorage.getItem('survival-map');if(['frontier','cubic'].includes(saved))selectedMap=saved;}catch{}
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.domElement.setAttribute('aria-label','Трёхмерная арена выживания');$('#world').append(renderer.domElement);
 const scene=new THREE.Scene();
 function stage(factory){const temporary=new THREE.Scene(),info=factory(temporary,{mobile,reducedMotion}),root=new THREE.Group();root.add(...temporary.children);scene.add(root);return Object.assign(info,{root,background:temporary.background,fog:temporary.fog});}
 const stages={frontier:stage(createDesertArena),cubic:stage(createCubicArena)};let arena=stages[selectedMap];
 function showStage(){arena=stages[selectedMap];for(const[id,s]of Object.entries(stages))s.root.visible=id===selectedMap;scene.background=arena.background;scene.fog=arena.fog;document.querySelectorAll('.map-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===selectedMap)));}
 showStage();
 const camera=new THREE.PerspectiveCamera(40,1,.1,100),cameraTarget=new THREE.Vector3(0,0,3);
 const run=new SurvivalRun({obstacles:arena.obstacles,bounds:arena.bounds,character:selectedCharacter,map:selectedMap});
 function syncMenuMusic(){music.sync({enabled:audio.enabled,phase:run.state.phase,paused:externalPause||document.hidden});}
 const unlockMenuMusic=()=>{syncMenuMusic();music.unlock();};
 document.addEventListener('pointerdown',unlockMenuMusic,{capture:true});document.addEventListener('keydown',unlockMenuMusic,{capture:true});
 const enemies=new SurvivalEnemies(scene,{mobile,camera,reducedMotion}),effects=new SurvivalEffects(scene,{camera,mobile}),pudgeEffects=new PudgeEffects(scene,{mobile});
 const menuStage=createMenuStage(scene,{mobile,reducedMotion}),lobbyBackground=new THREE.Color('#0c1930'),lobbyFog=new THREE.FogExp2('#0c1930',.025);
 let lobby,lobbyYaw=-.16,lobbyDrag=null,heroReveal=1,settledRun=false,lastReward=0;
 const actor=new THREE.Group();scene.add(actor);
 const steve=createSteve();actor.add(steve.root);steve.root.visible=selectedCharacter==='steve';
 const playerCircle=new THREE.Mesh(new THREE.RingGeometry(.53,.59,48),new THREE.MeshBasicMaterial({color:'#d4ffbd',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));playerCircle.rotation.x=-Math.PI/2;playerCircle.position.y=.025;actor.add(playerCircle);
 const shieldBubble=new THREE.Mesh(new THREE.SphereGeometry(.98,20,14),new THREE.MeshBasicMaterial({color:'#85d9ff',transparent:true,opacity:.13,depthWrite:false}));shieldBubble.position.y=.86;shieldBubble.visible=false;actor.add(shieldBubble);
 let model,mixer,baseAction,shotFeedback,pudge;const actions={};
 const floating=[];let toastTimer=0,shake=0;
 const hud=$('#hud'),menu=$('#menu'),upgradeOverlay=$('#upgrade-overlay');
 const hudIconImage=svg=>`data:image/svg+xml,${encodeURIComponent(svg.replaceAll('currentColor','#e6e5c9'))}`;
 $('#pause').innerHTML=`<img class="hud-control-icon" src="${hudIconImage(pauseIcon)}" alt="" width="24" height="24">`;$('#kills-icon').src=hudIconImage(lobbyIcon('skull'));
 const syncSoundIcon=()=>{$('#sound').innerHTML=`<img class="hud-control-icon" src="${hudIconImage(lobbyIcon(audio.enabled?'music':'music-off'))}" alt="" width="24" height="24">`;$('#sound').setAttribute('aria-pressed',String(audio.enabled));};syncSoundIcon();
 const fallbackWeaponImages={shelly:`data:image/svg+xml,${encodeURIComponent(icon('damage'))}`,pudge:`data:image/svg+xml,${encodeURIComponent(pudgeIcon('cleaver'))}`};
 const upgradeDefs=()=>getRunUpgradeDefs(run.state.character,run.weaponId);
 function upgradeIcon(id){return upgradeArtIcon(upgradePresentation(run.state,id).art);}
 // Warm all art during the lobby so a level-up never flashes empty cards.
 for(const url of Object.values(upgradeImages)){const image=new Image();image.src=url;}
 function syncCharacter(){
  const isSteve=selectedCharacter==='steve',isPudge=selectedCharacter==='pudge';
  steve.root.visible=isSteve;if(model)model.visible=selectedCharacter==='shelly';if(pudge)pudge.root.visible=isPudge;
  document.body.dataset.character=selectedCharacter;$('#change-hero-image').src=isSteve?stevePortraitURL:shellyPortraitURL;$('#change-hero-image').classList.toggle('steve-portrait',isSteve);
  $('#hero-name').textContent=isPudge?'ПУДЖ':isSteve?'СТИВ':'ШЕЛЛИ';$('#hero-portrait').src=isPudge?pudgePortraitURL:isSteve?stevePortraitURL:shellyPortraitURL;$('#hero-portrait').alt=isPudge?'Пудж':isSteve?'Стив':'Шелли';$('#hero-portrait').classList.toggle('steve-portrait',isSteve);$('#hero-portrait').classList.toggle('pudge-portrait',isPudge);
  const skill=getSteveSkill(run.skillId),ranged=getSteveWeapon(run.weaponId).attackMode==='ranged';
  $('#super-icon').innerHTML=isPudge?pudgeIcon('hook'):isSteve?steveSkillIcon(skill.id):icon('super');$('#super-label').textContent=isPudge?'КРЮК':isSteve?skill.shortName:'СУПЕР';$('#super').setAttribute('aria-label',isPudge?'Мясной крюк Пуджа — притяни ближайшего врага':isSteve?`${skill.name} — ${skill.description}`:'Супервыстрел Шелли — мощная дробь вперёд');
  $('#character-detail').textContent=isPudge?'Руби тесаком. Пробел — крюк. Выбери Rot в прокачке, чтобы открыть ядовитую ауру.':isSteve?`Атакуй выбранным оружием. Пробел — ${skill.name.toLowerCase()}.`:'Держи дистанцию и стреляй дробью. Пробел — мощный супер.';
  $('#lobby-hero-name').textContent=isPudge?'ПУДЖ':isSteve?'СТИВ':'ШЕЛЛИ';$('#lobby-hero-class').textContent=isSteve?(ranged?'СТРЕЛОК · ДАЛЬНИЙ БОЙ':'ВОИН · БЛИЖНИЙ БОЙ'):'СТРЕЛОК · ДАЛЬНИЙ БОЙ';
  document.querySelectorAll('[data-character]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.character===selectedCharacter));});
 }
 document.querySelectorAll('.steve-portrait').forEach(img=>img.src=stevePortraitURL);
 document.querySelectorAll('.pudge-portrait').forEach(img=>img.src=pudgePortraitURL);
 $('#sound').setAttribute('aria-pressed',String(audio.enabled));
 function formatTime(seconds){const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toString().padStart(2,'0')}`;}
 function notify(text,seconds=2){$('#notifications').textContent=text;$('#notifications').classList.add('show');toastTimer=seconds;}
 function clearInput(){keys.clear();movement.x=movement.z=0;superRequested=false;stickPointer=null;$('#move-stick i').style.transform='';}
 function characterReady(){return loaded&&(selectedCharacter!=='pudge'||!!pudge);}
 function active(){return characterReady()&&!externalPause&&run.state.phase==='playing';}
 function resetPresentation(){effects.clear();nextStatusPixels=0;pudgeEffects.reset();floating.forEach(n=>n.element.remove());floating.length=0;renderedPhase='';previousBuild='';shotFeedback?.reset();steve.reset();pudge?.reset();actor.scale.setScalar(1);$('#notifications').classList.remove('show');toastTimer=0;cameraTarget.set(0,0,3);clearInput();}
 function begin(mode=run.mode){run.restart();run.setMode(mode);run.start();settledRun=false;lastReward=0;lobby?.close();resetPresentation();syncCharacter();audio.unlock();updateUI(true);positionCamera(0,true);}
 function chooseCharacter(character){
  if(run.state.phase!=='ready'||!['steve','shelly'].includes(character))return;selectedCharacter=character;run.setCharacter(character);lobbyYaw=-.16;heroReveal=reducedMotion?1:0;resetPresentation();syncCharacter();actor.position.set(0,0,0);actor.rotation.y=lobbyYaw;
  try{localStorage.setItem('survival-character',character);}catch{}updateUI(true);positionCamera(0,true);
 }
 for(const button of document.querySelectorAll('.character-options button'))button.addEventListener('click',()=>chooseCharacter(button.dataset.character));
 function chooseWeapon(id){
  if(run.state.phase!=='ready'||!run.setWeapon(id))return false;
  steve.setWeapon(id);resetPresentation();syncCharacter();updateUI(true);return true;
 }
 function chooseSkill(id){
  if(run.state.phase!=='ready'||!run.setSkill(id))return false;
  resetPresentation();syncCharacter();updateUI(true);return true;
 }
 function chooseMap(map){
  if(run.state.phase!=='ready'||!stages[map])return;selectedMap=map;showStage();run.map=map;run.obstacles=arena.obstacles.map(o=>({...o}));run.bounds={...arena.bounds};run.restart();resetPresentation();syncCharacter();try{localStorage.setItem('survival-map',map);}catch{}updateUI(true);positionCamera(0,true);
 }
 function saveResult(){if(settledRun)return;settledRun=true;const s=run.state;record.kills=Math.max(record.kills,s.kills);record.time=Math.max(record.time,s.elapsed);if(s.phase==='won')record.wins++;try{localStorage.setItem(recordsKey,JSON.stringify(record));}catch{}lastReward=lobby?.recordResult(s)||0;}
 function syncScene(){const ready=run.state.phase==='ready';renderDirty=true;renderer.setPixelRatio(Math.min(devicePixelRatio,ready?(mobile?1.25:1.5):(mobile?1.4:1.8)));renderer.setSize(innerWidth,innerHeight);document.body.dataset.lobbyScene=String(ready);renderer.setClearColor('#060d1c',ready?0:1);menuStage.root.visible=ready;if(ready)menuStage.resize?.(innerWidth,innerHeight);for(const[id,stage]of Object.entries(stages))stage.root.visible=!ready&&id===selectedMap;scene.background=ready?null:arena.background;scene.fog=ready?null:arena.fog;}
 function updateMenu(phase){
  const paused=phase==='paused',won=phase==='won',finished=['won','dead','retired'].includes(phase),ready=phase==='ready';menu.dataset.view=phase;
  $('#run-summary').hidden=ready;$('#result-stats').hidden=!finished;$('#restart').hidden=!paused;$('#back-lobby').textContent=paused?'Завершить забег':'В лобби';$('#start').disabled=!characterReady();
  (ready?$('#nav-play-slot'):$('#summary-primary')).append($('#start'));
  if(paused){$('#menu-title').textContent='Пауза';$('#menu-description').textContent='Время остановлено';$('#start span').textContent='ПРОДОЛЖИТЬ';}
  else if(finished){saveResult();$('#menu-title').textContent=won?'Победа':phase==='retired'?'Забег завершён':'Поражение';$('#menu-description').textContent='';$('#result-stats').innerHTML=`<div><b>${formatTime(run.state.elapsed)}</b><span>ВРЕМЯ</span></div><div><b>${run.state.kills}</b><span>ВРАГОВ</span></div><div><b>${run.state.stats.bosses||0}</b><span>БОССОВ</span></div>`;$('#start span').textContent='ЕЩЁ РАЗ';}
  else $('#start span').textContent=characterReady()?'ИГРАТЬ':'ЗАГРУЗКА';
  $('#result-reward').hidden=!finished;$('#result-reward').textContent=`+${shardAmount(lastReward)} за забег`;
  $('#best-record').textContent=record.time>0?`${formatTime(record.time)} · Побед: ${record.wins}`:'Первый рекорд впереди';lobby?.refresh();
 }
 function showChoices(){
  const state=run.state;$('#upgrade-description').textContent=`Уровень ${state.level} · выбери одно`;
  const container=$('#upgrade-choices');container.replaceChildren();
  updateCombinationProgress($('#combo-progress'),state);
  state.choices.forEach((choice,index)=>container.append(createUpgradeCard(state,choice.id,index,choose)));
  container.closest('.upgrade-sheet').scrollTop=0;
 }
 function choose(id){
  const combo=getUpgradeCombination(run.state.character,run.weaponId);
  const wasUnlocked=combo&&isCombinationUnlocked(combo,run.state.upgrades);
  if(!run.chooseUpgrade(id))return;
  audio.unlock();audio.tone(680,.12,.15,960);clearInput();
  if(run.state.phase==='playing'){
   if(combo&&!wasUnlocked&&isCombinationUnlocked(combo,run.state.upgrades))notify(`${combo.name} · В СЛЕДУЮЩЕМ ВЫБОРЕ`,2);
   else notify(upgradeDefs().find(u=>u.id===id)?.name||'Улучшение получено',1.3);
  }
  updateUI(true);
 }

 function updateBuild(s){
  const combo=getUpgradeCombination(s.character,run.weaponId);
  const buildKey=s.character+JSON.stringify(s.upgrades);
  if(previousBuild!==buildKey){
   previousBuild=buildKey;
   const definitions=upgradeDefs();
   const activeUpgrades=Object.entries(s.upgrades).filter(([id,n])=>n>0&&id!=='damage');
   activeUpgrades.sort(([id],[other])=>Number(other===combo?.id)-Number(id===combo?.id));
   $('#build-items').innerHTML=activeUpgrades.map(([id,n])=>{
    const name=definitions.find(definition=>definition.id===id)?.name||'';
    const comboAttributes=id===combo?.id?` data-combination="${id}"`:'';
    return `<span class="build-chip"${comboAttributes} title="${name}">${upgradeIcon(id)}<b>${n}</b></span>`;
   }).join('');
   $('#build-hint').textContent='ТВОЯ СБОРКА';
  }
  const chip=$('#build-items [data-combination]');
  if(!chip)return;
  const stats=combinationRank(combo.id,s.upgrades[combo.id]);
  const remaining=Math.max(0,(s.comboReadyAt||0)-s.elapsed);
  chip.style.setProperty('--combo-charge',Math.max(0,1-remaining/stats.cooldown));
  chip.dataset.ready=String(remaining===0);
 }
 function updateBuffs(buffs){
  const definitions={haste:{...BOOSTS.haste,summary:'+35% к скорости'},rapid:{...BOOSTS.rapid,name:run.state.character!=='shelly'?'БЫСТРАЯ АТАКА':'БЫСТРЫЙ ОГОНЬ',summary:'Темп атаки ×1,67'},shield:{...BOOSTS.shield,name:'ЩИТ',summary:'Без урона'}};
  const panel=$('#buffs');
  let rotBadge=panel.querySelector('[data-passive="rot"]');const rot=run.state.player.rot;
  if(run.state.character==='pudge'){if(!rotBadge){rotBadge=document.createElement('div');rotBadge.className='buff-badge';rotBadge.dataset.passive='rot';rotBadge.innerHTML=`<span>${pudgeIcon('rot')}</span><b>ROT</b><small></small>`;panel.prepend(rotBadge);}rotBadge.classList.toggle('locked',!rot.level);rotBadge.querySelector('small').textContent=rot.level?`УР. ${rot.level}`:'В ПРОКАЧКЕ';rotBadge.title=rot.level?`${rot.dps} урона/с · замедление 20% · радиус ${rot.radius.toFixed(1)}`:'Выбери карточку Rot при повышении уровня';}else rotBadge?.remove();
  for(const [id,definition] of Object.entries(definitions)){
   let badge=panel.querySelector(`[data-buff="${id}"]`);const remaining=buffs[id]||0;
   if(remaining<=0){badge?.remove();continue;}
   if(!badge){badge=document.createElement('div');badge.className='buff-badge';badge.dataset.buff=id;badge.innerHTML=`<span>${boostIcon(id)}</span><div class="buff-copy"><b>${definition.name}</b><small>${definition.summary}</small></div><small class="buff-time"></small><i></i>`;panel.append(badge);}
   badge.title=`${definition.name} · ${definition.summary}`;badge.querySelector('.buff-time').textContent=`${Math.ceil(remaining)}с`;badge.querySelector('i').style.transform=`scaleX(${Math.min(1,remaining/definition.duration)})`;
  }
  const debuffs=run.state.player.debuffs||{};
  for(const [id,name,summary,mark,duration] of [['slow','ЗАМЕДЛЕНИЕ','−20% скорости','−20%',2.5],['poison','ОТРАВЛЕНИЕ','−2 здоровья/с','2/с',3]]){
   let badge=panel.querySelector(`[data-debuff="${id}"]`);const remaining=debuffs[id]||0;
   if(remaining<=0){badge?.remove();continue;}
   if(!badge){badge=document.createElement('div');badge.className='buff-badge debuff-badge';badge.dataset.debuff=id;badge.innerHTML=`<span class="status-mark">${mark}</span><div class="buff-copy"><b>${name}</b><small>${summary}</small></div><small class="buff-time"></small><i></i>`;panel.append(badge);}
   badge.title=`${name} · ${summary}`;badge.querySelector('.buff-time').textContent=`${Math.ceil(remaining)}с`;badge.querySelector('i').style.transform=`scaleX(${Math.min(1,remaining/duration)})`;
  }
 }
 const pickupProjection=new THREE.Vector3();let hintedDrop=null;
 function updatePickupHint(){
  const hint=$('#pickup-hint'),s=run.state,p=s.player;
  let closest=null,distance=5.2;
  if(s.phase==='playing')for(const d of s.drops){if(!BOOSTS[d.type]||d.collected||d.life<=0)continue;const length=Math.hypot(d.x-p.x,d.z-p.z);if(length<distance){closest=d;distance=length;}}
  hint.hidden=!closest;if(!closest){hintedDrop=null;return;}
  const definition=BOOSTS[closest.type];
  if(hintedDrop!==closest.id){hintedDrop=closest.id;hint.dataset.boost=closest.type;hint.style.setProperty('--boost',definition.colour);hint.querySelector('span').innerHTML=boostIcon(closest.type);hint.querySelector('b').textContent=definition.name;hint.querySelector('small').textContent=definition.detail;}
  pickupProjection.set(closest.x,1.48,closest.z).project(camera);
  if(pickupProjection.z>1){hint.hidden=true;return;}
  const x=(pickupProjection.x*.5+.5)*innerWidth,y=(-pickupProjection.y*.5+.5)*innerHeight;
  hint.style.left=`${Math.max(104,Math.min(innerWidth-104,x))}px`;
  hint.style.top=`${Math.max(innerHeight<541?135:205,Math.min(innerHeight-125,y))}px`;
 }
 function updateUI(force=false){
  const s=run.state,p=s.player;syncMenuMusic();
  const phaseChanged=renderedPhase!==s.phase;
  if(phaseChanged){renderedPhase=s.phase;clearInput();menu.hidden=!['ready','paused','dead','won','retired'].includes(s.phase);document.body.dataset.menu=String(!menu.hidden);syncScene();upgradeOverlay.hidden=s.phase!=='upgrade';platform.setGameplay(s.phase==='playing');
   if(s.phase==='upgrade')showChoices();else if(!menu.hidden)updateMenu(s.phase);
   if(s.phase==='paused')audio.pause();
  }
  hud.dataset.phase=s.phase;hud.dataset.active=String(active());hud.dataset.x=p.x.toFixed(3);hud.dataset.z=p.z.toFixed(3);hud.dataset.hp=p.hp.toFixed(2);hud.dataset.fireInterval=p.weapon.fireInterval;hud.dataset.super=p.super.toFixed(1);hud.dataset.kills=s.kills;hud.dataset.level=s.level;hud.dataset.elapsed=s.elapsed.toFixed(2);hud.dataset.enemies=s.enemies.length;hud.dataset.shots=s.stats.shots;hud.dataset.choices=s.choices.map(c=>c.id).join(',');hud.dataset.boss=String(s.bossId!==null);
  hud.dataset.mode=s.mode;hud.dataset.character=s.character;hud.dataset.map=s.map;hud.dataset.bow=String(p.bowTime>0);hud.dataset.bowTime=p.bowTime.toFixed(2);hud.dataset.rot=String(p.rot?.level||0);
  hud.dataset.weapon=run.weaponId;hud.dataset.skill=run.skillId;hud.dataset.skillTime=p.skillTime.toFixed(2);hud.dataset.poisoned=String((p.debuffs?.poison||0)>0);hud.dataset.slowed=String((p.debuffs?.slow||0)>0);
  $('#hero-weapon').textContent=s.character==='pudge'?'ТЕСАК':s.character==='steve'?(p.bowTime>0?'ЛУК':getSteveWeapon(run.weaponId).name.toUpperCase()):'ДРОБОВИК';
  const weaponImage=$('#build-weapon-image'),weaponSource=s.character==='steve'?(p.bowTime>0?bowIconURL:steveWeaponImage(run.weaponId)):fallbackWeaponImages[s.character];
  if(weaponImage.getAttribute('src')!==weaponSource)weaponImage.src=weaponSource;
  weaponImage.alt=$('#hero-weapon').textContent;weaponImage.parentElement.title=`${weaponImage.alt} · урон ${Math.round(p.weapon.damage)}`;
  $('#build-weapon-rank').hidden=!s.upgrades.damage;$('#build-weapon-rank').textContent=s.upgrades.damage||'';
  $('#health-fill').style.width=`${Math.max(0,p.hp/p.maxHp)*100}%`;$('#health-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('#hero-level').textContent=`УР. ${s.level}`;$('#clock').textContent=formatTime(s.mode==='endless'?Math.max(0,s.elapsed-.999):s.remaining);$('#wave-label').textContent=s.mode==='endless'?`СОЛО · ЭТАП ${(s.stats.bosses||0)+1}`:s.bossId!==null?'ФИНАЛЬНАЯ ВОЛНА':`ВОЛНА ${s.wave}`;$('#clock-caption').textContent=s.mode==='endless'?(s.bossId!==null?'БОСС НА АРЕНЕ':`БОСС ЧЕРЕЗ ${formatTime(s.remaining)}`):s.bossId!==null?(s.map==='cubic'?'ПОБЕДИ ГОЛЕМА':'ПОБЕДИ МОГИЛЬЩИКА'):'ДО ПРИХОДА БОССА';$('#kills').textContent=s.kills;
  $('#level-label').textContent=`УРОВЕНЬ ${s.level}`;$('#xp-text').textContent=`${Math.floor(s.xp)} / ${s.xpNeeded}`;$('#xp-fill').style.width=`${Math.min(1,s.xp/s.xpNeeded)*100}%`;
  $('#run-progress-label').textContent=s.bossId!==null?'БОСС НА АРЕНЕ':'ДО БОССА';$('#run-progress-detail').textContent=s.bossId!==null?`ПОБЕЖДЕНО БОССОВ: ${s.stats.bosses}`:formatTime(s.remaining);
  $('.health-track').setAttribute('aria-label',`Здоровье: ${Math.ceil(p.hp)} из ${p.maxHp}`);$('.xp-row').setAttribute('aria-label',`Опыт: ${Math.floor(s.xp)} из ${s.xpNeeded}`);
  updateBuffs(p.buffs||{});
  const skillActive=p.skillTime>0,ready=p.super>=100&&p.superCooldown<=0&&!skillActive,skill=getSteveSkill(run.skillId);$('#super').disabled=!active()||!ready;$('#super').classList.toggle('ready',ready);$('#super-state').textContent=skillActive?`${Math.ceil(p.skillTime)} СЕК`:ready?'ГОТОВО':p.super>=100&&p.superCooldown>0?`${Math.ceil(p.superCooldown)} СЕК`:`${Math.floor(p.super)}%`;$('#ability-fill').style.transform=`scaleX(${skillActive?p.skillTime/skill.duration:0})`;
  const boss=s.enemies.find(e=>e.id===s.bossId&&e.hp>0);$('#boss-hud').hidden=!boss;if(boss){$('#boss-hud b').textContent=boss.bossName||(s.map==='cubic'?'ЗАРАЖЁННЫЙ ГОЛЕМ':'МОГИЛЬЩИК');$('#boss-hp-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp)*100}%`;$('#boss-hp-text').textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;}
  updateBuild(s);
 }
 $('#start').addEventListener('click',()=>{if(!characterReady())return;audio.unlock();if(run.state.phase==='paused'){run.resume();updateUI(true);}else if(run.state.phase==='ready')lobby.open('play');else begin();});
 $('#restart').addEventListener('click',()=>begin());
 $('#back-lobby').addEventListener('click',()=>{if(run.state.phase==='paused'){run.retire();handleEvents();updateUI(true);return;}run.restart();resetPresentation();syncCharacter();updateUI(true);positionCamera(0,true);});
 function togglePause(){if(run.state.phase==='paused'){run.resume();audio.unlock();}else if(run.state.phase==='playing'||run.state.phase==='upgrade')run.pause();updateUI(true);}
 $('#pause').addEventListener('click',togglePause);
 function toggleSound(){audio.setEnabled(!audio.enabled);syncSoundIcon();syncMenuMusic();if(!active())audio.pause();try{localStorage.setItem('shelly-range-sound',audio.enabled?'on':'off');}catch{}lobby?.refresh();}
 $('#sound').addEventListener('click',toggleSound);
 lobby=new Lobby({getState:()=>run.state,getRecord:()=>record,getCharacter:()=>selectedCharacter,getMap:()=>selectedMap,onCharacter:chooseCharacter,onMap:chooseMap,onLaunch:begin,onSound:toggleSound,isSoundEnabled:()=>audio.enabled,onCosmetic:color=>{playerCircle.material.color.set(color);},onWeapon:chooseWeapon,onSkill:chooseSkill,onVolumeChange:({music:volume,sfx})=>{music.setVolume(volume);audio.setVolume(sfx);}});
 chooseWeapon(lobby.profile.weapon);
 const showcase=$('.lobby-showcase');showcase.addEventListener('pointerdown',e=>{if(run.state.phase!=='ready')return;lobbyDrag={id:e.pointerId,x:e.clientX,yaw:lobbyYaw};showcase.setPointerCapture(e.pointerId);});showcase.addEventListener('pointermove',e=>{if(lobbyDrag?.id===e.pointerId)lobbyYaw=lobbyDrag.yaw+(e.clientX-lobbyDrag.x)*.012;});for(const type of ['pointerup','pointercancel','lostpointercapture'])showcase.addEventListener(type,()=>lobbyDrag=null);
 $('#super').addEventListener('click',()=>{if(active())superRequested=true;});
 platform.onPauseChange(paused=>{externalPause=paused;clearInput();if(paused)audio.pause();else if(active())audio.unlock();updateUI(true);});
 window.addEventListener('keydown',event=>{
  if($('#lobby-panel').open)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape','KeyP','Digit1','Digit2','Digit3'].includes(event.code))event.preventDefault();
  if(['Escape','KeyP'].includes(event.code)){if(!event.repeat)togglePause();return;}
  if(run.state.phase==='upgrade'&&/^Digit[123]$/.test(event.code)){const c=run.state.choices[Number(event.code.slice(-1))-1];if(c)choose(c.id);return;}
  if(!active())return;keys.add(event.code);if(event.code==='Space'&&!event.repeat)superRequested=true;
 });
 window.addEventListener('keyup',event=>keys.delete(event.code));
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 const stick=$('#move-stick'),knob=stick.querySelector('i');
 function updateStick(event){const r=stick.getBoundingClientRect(),max=r.width*.31,dx=event.clientX-r.x-r.width/2,dy=event.clientY-r.y-r.height/2,n=Math.hypot(dx,dy),scale=n>max?max/n:1;movement.x=dx*scale/max;movement.z=dy*scale/max;knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
 stick.addEventListener('pointerdown',e=>{if(!active()||stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);audio.unlock();updateStick(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer&&active())updateStick(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;movement.x=movement.z=0;knob.style.transform='';});
 function damageNumber(event){if(floating.length>45)return;const element=document.createElement('span');element.className='damage-number'+(event.cause==='super'?' super':'');element.textContent=Math.round(event.damage);$('#damage-layer').append(element);floating.push({element,x:event.x,z:event.z,y:event.cause==='super'?1.6:1.3,life:.66});}
 function onShot(){shotFeedback?.trigger();audio.burst(.13,.65,2100);audio.tone(115,.105,.48,48);}
 function handleEvents(){
  const events=run.drainEvents(),damage=new Map();let hitAudio=false;
  const pixelsEnabled=lobby?.profile.effects!==false;
  const litTargets=new Set();
  let smallEffects=mobile?5:9;
  for(const e of events){
   const minor=e.type==='hit'||e.type==='pickup'||e.type==='ricochet'||e.type==='enemyshot'||(e.type==='kill'&&e.enemyType!=='boss');
   const duplicate=e.type==='hit'&&litTargets.has(e.id);
   const pixelShown=pixelsEnabled&&!duplicate&&(!minor||smallEffects>0)&&playCombatPixelFx(effects,e,run.state,reducedMotion);
   if(pixelShown&&minor)smallEffects--;
   if(pixelShown&&e.type==='hit')litTargets.add(e.id);
   if(e.type==='shot'){onShot();}
   else if(e.type==='melee'){if(e.character==='pudge')pudge?.attack(e);else steve.attack({kind:'melee',interval:e.interval,duration:e.duration});audio.burst(.10,.22,2600);audio.tone(e.character==='pudge'?150:260,.09,.10,90);}
   else if(e.type==='meleeimpact'){if(e.echo){if(e.character==='pudge')pudge?.attack({duration:.3});else steve.attack({kind:'melee'});}if(!pixelShown)effects.swordSweep(e.x,e.z,e.angle,e.range,e.arc,e.character==='pudge'?'#e3c588':'#a3fff1');}
   else if(e.type==='hook'){pudge?.hook();pudgeEffects.hook(e);audio.burst(.14,.18,900);audio.tone(185,.17,.17,80);notify(e.boss?'КРЮК · УДАР ПО БОССУ':'КРЮК · ВРАГ ПРИТЯНУТ',1.2);}
   else if(e.type==='rotpulse')pudgeEffects.pulse(e);
   else if(e.type==='abilityempty')notify('КРЮК · ПОДОЙДИ БЛИЖЕ К ВРАГУ',1.3);
   else if(e.type==='bowshot'){steve.attack({kind:'bow'});audio.tone(520,.07,.17,210);audio.burst(.035,.10,3600);}
   else if(e.type==='rangedshot'){steve.attack({kind:'ranged',interval:e.interval});if(e.kind==='ember'){audio.tone(190,.12,.1,460);if(!pixelShown)effects.burst(e.x,e.z,5,'#ffad46',1.1);}else{audio.tone(e.kind==='bolt'?260:520,.07,.14,180);audio.burst(.04,.08,3200);}}
   else if(e.type==='emberblast'){if(!pixelShown)effects.emberImpact?.(e.x,e.z,e.radius);}
   else if(e.type==='comboproc'){
    if(lobby?.profile.effects!==false)effects.combo(e,{reducedMotion});
    if(e.combo==='echo-wave')audio.tone(310,.18,.13,690);
    else if(e.combo==='fire-ricochet'){audio.tone(620,.12,.10,210);audio.burst(.06,.11,1700);}
    else{audio.tone(170,.10,.13,95);audio.burst(.065,.15,2400);}
   }
   else if(e.type==='frosthit'){if(!pixelShown)effects.burst(e.x,e.z,4,'#b9eeff',.8);}
   else if(e.type==='bossability'){effects.bossAbility?.(e);if(e.stage==='lock')audio.tone(690,.12,.08,890);else if(e.stage==='fire')audio.tone(e.hazard==='sonic'?95:e.hazard==='guardian'?360:145,.16,.12,70);}
   else if(e.type==='reflect'||e.type==='dashend'){effects.skill?.(e);if(e.type==='reflect')audio.tone(880,.06,.055,1200);}
   else if(e.type==='hit'){const key=e.id+':'+e.cause,old=damage.get(key);if(old)old.damage+=e.damage;else damage.set(key,{...e});if(!pixelsEnabled&&e.cause!=='rot')effects.burst(e.x,e.z,3,e.cause==='burn'?'#ff8c43':e.cause==='sword'?'#85f4dd':'#ffdf89');hitAudio=true;}
   else if(e.type==='kill'){if(!pixelsEnabled)effects.burst(e.x,e.z,e.enemyType==='boss'?40:8,'#c9e6a3',.7);}
   else if(e.type==='hurt'){$('#hurt-flash').classList.add('show');setTimeout(()=>$('#hurt-flash').classList.remove('show'),140);audio.burst(.08,.2,620);if(!reducedMotion)shake=.035;}
   else if(e.type==='pickup'){audio.tone(820,.045,.035,1050);}
   else if(e.type==='bonus'){const definition=BOOSTS[e.bonus];const text=e.bonus==='heal'?`ЛЕЧЕНИЕ · +${Math.round(e.amount)} ЗДОРОВЬЯ`:e.bonus==='magnet'?'МАГНИТ · ВЕСЬ ОПЫТ СОБРАН':`${definition?.name||'БОНУС'} · ${definition?.detail||''}`;notify(text,1.8);if(!pixelShown)effects.ring(e.x,e.z,definition?.colour||'#9cdcff',1.3);audio.tone(620,.16,.13,1030);}
   else if(e.type==='debuff')notify(e.debuff==='slow'?'ЗАМЕДЛЕНИЕ · −20% СКОРОСТИ':'ОТРАВЛЕНИЕ · −2 ЗДОРОВЬЯ/С',1.8);
   else if(e.type==='levelup'){audio.tone(560,.2,.15,900);notify(`УРОВЕНЬ ${run.state.level} · ВЫБЕРИ УЛУЧШЕНИЕ`,2);}
   else if(e.type==='super'){const p=run.state.player;if(e.character==='steve'){effects.skill?.(e);if(e.ability==='bow'){steve.super?.();effects.ring(p.x,p.z,'#8bf5df',1.5);audio.tone(420,.18,.18,820);}else if(e.ability==='dash')audio.tone(360,.15,.16,780);else audio.tone(480,.25,.13,960);notify(getSteveSkill(e.ability).name.toUpperCase(),1.5);}else{shotFeedback?.trigger({power:1.55});effects.shotgun(p.x+e.dx*.58,p.z+e.dz*.58,e.dx,e.dz,true);audio.burst(.24,.8,1800);audio.tone(100,.20,.65,42);notify('СУПЕРВЫСТРЕЛ · МОЩНАЯ ДРОБЬ ВПЕРЁД',1.3);if(!reducedMotion)shake=.07;}}
   else if(e.type==='horderank')notify(`ОРДА УСИЛИЛАСЬ · РАНГ ${e.rank}`,2);
   else if(e.type==='wave'&&run.state.mode!=='endless')notify(`ВОЛНА ${e.wave} · ОРДА СТАНОВИТСЯ СИЛЬНЕЕ`,2.1);
   else if(e.type==='bossdefeated'){notify('БОСС ПОВЕРЖЕН · НОВЫЙ ЭТАП ОРДЫ',2.5);effects.ring(run.state.player.x,run.state.player.z,'#a6e3dc',3);audio.tone(660,.25,.2,990);}
   else if(e.type==='boss'){const boss=run.state.enemies.find(b=>b.id===e.id);const name=boss?.bossName||ENDLESS_BOSSES[boss?.bossVariant]?.name||(run.state.map==='cubic'?'Заражённый голем':'Могильщик');notify(`${name.toUpperCase()} НА АРЕНЕ`,3);audio.tone(120,.6,.3,65);}
   else if(e.type==='warning'){const text=e.hazard==='charge'?'РЫВОК · УЙДИ С ПУТИ':e.hazard==='sonic'?'ЗВУКОВОЙ УДАР · ВЫЙДИ ИЗ ЗОНЫ':e.hazard==='guardian'?'ЛУЧ СТРАЖА · ВЫЙДИ ИЗ ЗОНЫ':e.hazard==='wither'?'ВЗРЫВ ВИЗЕРА · ОТОЙДИ':e.hazard==='dragon'?'ДЫХАНИЕ ДРАКОНА · ОТОЙДИ':e.hazard==='explode'?'КРИПЕР! ОТОЙДИ ОТ КРУГА':'ОПАСНАЯ ЗОНА · ОТОЙДИ';notify(text,1.3);}
   else if(e.type==='slam'&&!e.bossAbility){const colour=['sonic','guardian'].includes(e.hazard)?'#96e7ff':e.hazard==='wither'?'#d0a4ff':'#ff8473';if(!pixelShown){effects.ring(e.x,e.z,colour,e.radius||3);effects.burst(e.x,e.z,15,colour,.2);}if(e.beam)effects.beam(e.fromX,e.fromZ,e.x,e.z,colour);}
   else if(e.type==='win'){audio.tone(660,.6,.25,990);audio.tone(830,.5,.12);}
   else if(e.type==='lose')audio.tone(240,.6,.2,90);
  }
  if(hitAudio)audio.hit();for(const e of damage.values())damageNumber(e);
 }
 function animateCharacter(dt){
  const p=run.state.player;actor.scale.setScalar(1);actor.position.set(p.x,0,p.z);actor.rotation.y=p.angle;playerCircle.visible=true;
  const isSteve=p.character==='steve',isPudge=p.character==='pudge';steve.root.visible=isSteve&&p.hp>0;if(model)model.visible=p.character==='shelly'&&p.hp>0;if(pudge)pudge.root.visible=isPudge&&p.hp>0;
  if(isSteve){steve.update(dt,{moving:p.moving,elapsed:run.state.elapsed,phase:run.state.phase,bowActive:p.bowTime>0});}
  else if(isPudge)pudge?.update(dt,{moving:p.moving});
  else{const next=p.moving?actions.Walk:actions.Idle;if(next&&next!==baseAction){const old=baseAction;baseAction=next;next.reset().play();old?.crossFadeTo(next,.12,false);}shotFeedback?.restorePose();mixer?.update(dt);shotFeedback?.update(dt);}
  shieldBubble.visible=(p.buffs?.shield||0)>0||p.bulwarkTime>0;shieldBubble.material.color.set(p.bulwarkTime>0?'#ffe5a3':'#85d9ff');shieldBubble.material.opacity=.12+Math.sin(run.state.elapsed*5)*.025;playerCircle.material.color.set(shieldBubble.visible?'#89dfff':p.debuffs?.poison>0?'#bbec76':p.debuffs?.slow>0?'#b7f0ff':(p.buffs?.haste||0)>0?'#7cf1ae':lobby?.cosmetic.color||'#80e3dd');if(p.invulnerable>0)playerCircle.material.opacity=.35+.3*Math.sin(p.invulnerable*30);else playerCircle.material.opacity=.65;
 }
 function updateEffects(dt){
  const state=run.state;
  if(dt>0&&state.phase==='playing'&&!reducedMotion&&lobby?.profile.effects!==false&&state.elapsed>=nextStatusPixels){
   nextStatusPixels=state.elapsed+.38;
   playStatusPixelFx(effects,state,mobile?3:5);
  }
  effects.update(dt,{player:state.player,camera});if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#notifications').classList.remove('show');}
  for(let i=floating.length-1;i>=0;i--){const n=floating[i];n.life-=dt;n.y+=dt*1.1;const v=new THREE.Vector3(n.x,n.y,n.z).project(camera);n.element.style.left=`${(v.x*.5+.5)*innerWidth}px`;n.element.style.top=`${(-v.y*.5+.5)*innerHeight}px`;n.element.style.opacity=Math.min(1,n.life*3);if(n.life<=0){n.element.remove();floating.splice(i,1);}}
 }
 function positionCamera(dt,instant=false){const p=run.state.player,dest=new THREE.Vector3(p.x*.68,0,p.z-1.5);cameraTarget.lerp(dest,instant?1:1-Math.exp(-dt*5));if(run.state.phase==='ready'){camera.position.set(0,3.3,10.5);camera.lookAt(0,camera.aspect<.8?1.12:1.22,0);return;}const distance=camera.aspect<.8?18.1:14.8;camera.position.set(cameraTarget.x,distance,cameraTarget.z+distance*.80);if(shake>0&&!externalPause&&run.state.phase==='playing'){camera.position.x+=(Math.random()-.5)*shake;camera.position.z+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*.6);}camera.lookAt(cameraTarget);}
 function resize(){renderDirty=true;if(run.state.phase==='ready')menuStage.resize?.(innerWidth,innerHeight);renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();positionCamera(0,true);}
 window.addEventListener('resize',resize);resize();syncCharacter();updateUI(true);
 new GLTFLoader().load(characterURL,gltf=>{
  model=gltf.scene;model.scale.setScalar(.46);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});actor.add(model);mixer=new THREE.AnimationMixer(model);
  for(const clip of gltf.animations){if(clip.name!=='Attack')actions[clip.name]=mixer.clipAction(clip);}
  baseAction=actions.Idle;baseAction?.play();mixer.update(0);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);model.position.y-=bounds.min.y;shotFeedback=new ShotFeedback(scene,model,{clips:gltf.animations});
  syncCharacter();
  loaded=true;document.body.dataset.ready='true';$('#start').disabled=!characterReady();$('#start span').textContent='ИГРАТЬ';platform.markReady();updateUI(true);
 },undefined,error=>{console.error(error);$('#start').disabled=false;$('#start span').textContent='ПЕРЕЗАГРУЗИТЬ';$('#menu-description').textContent='Не удалось загрузить Шелли. Нажми, чтобы попробовать ещё раз.';$('#start').onclick=()=>location.reload();});
 if(selectedCharacter==='pudge')loadPudge().then(hero=>{pudge=hero;actor.add(hero.root);const button=$('.character-options [data-character="pudge"]');button.disabled=false;$('#pudge-load-label').textContent='Тесак · крюк · Rot';document.body.dataset.pudgeReady='true';syncCharacter();if(!menu.hidden)updateMenu(run.state.phase);updateUI(true);}).catch(error=>{console.error('Pudge loading failed',error);$('#pudge-load-label').textContent='Не загрузился';if(selectedCharacter==='pudge'){selectedCharacter='steve';run.setCharacter('steve');syncCharacter();updateMenu(run.state.phase);}notify('Не удалось загрузить Пуджа. Обнови страницу.',4);});
 if(import.meta.env.DEV&&['127.0.0.1','localhost'].includes(location.hostname)){window.__survivalTest={run,get arena(){return arena;},snapshot:()=>structuredClone(run.state),get shotFeedback(){return shotFeedback;},get model(){return model;},get mixer(){return mixer;},get steve(){return steve;},get lobby(){return lobby;},get menuStage(){return menuStage;},get renderInfo(){return{...renderer.info.render,pixelRatio:renderer.getPixelRatio()};},get pudge(){return pudge;},get pudgeEffects(){return pudgeEffects;},get actor(){return actor;},get enemies(){return enemies;},get effects(){return effects;}};}
 let previous=performance.now();renderer.setAnimationLoop(now=>{
  let dt=Math.min((now-previous)/1000,.12);previous=now;if(externalPause)return;
  const phase=run.state.phase,samePhase=renderedPhase===phase;if(samePhase&&!renderDirty&&((phase==='ready'&&$('#lobby-panel').open)||['paused','upgrade','dead','won','retired'].includes(phase)))return;
  if(phase==='ready'){menuFrameClock+=dt;if(!renderDirty&&menuFrameClock<(lobbyDrag?1/60:1/30))return;dt=Math.min(.12,menuFrameClock);menuFrameClock=0;}else menuFrameClock=0;
  const wasActive=active();if(wasActive){const x=movement.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),z=movement.z+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);run.update(dt,{x,z,super:superRequested});superRequested=false;handleEvents();animateCharacter(dt);updateEffects(dt);stepClock+=dt;if(run.state.player.moving&&stepClock>.28){audio.step();stepClock=0;}}
  else if(characterReady()&&run.state.phase==='ready'){heroReveal=Math.min(1,heroReveal+dt*4);actor.scale.setScalar((camera.aspect<.8?1.18:innerHeight<541?1.45:1.4)*(.93+.07*(1-Math.pow(1-heroReveal,3))));actor.position.set(0,0,0);actor.rotation.y=lobbyYaw;playerCircle.visible=false;shieldBubble.visible=false;menuStage.update(dt,{effects:lobby?.profile.effects!==false});if(selectedCharacter==='steve')steve.update(dt,{moving:false,elapsed:run.state.elapsed,phase:'ready',bowActive:false});else mixer?.update(dt);}
  positionCamera(dt);updatePickupHint();if(run.state.phase!=='ready')arena.update?.(run.state.player,{dt:wasActive?dt:0,elapsed:run.state.elapsed,effects:lobby?.profile.effects!==false,paused:!wasActive});enemies.update(run.state,run.state.elapsed,wasActive?dt:0);pudgeEffects.update(wasActive?dt:0,run.state);hudClock+=dt;if(hudClock>.08||renderedPhase!==run.state.phase){updateUI();hudClock=0;}renderer.render(scene,camera);renderDirty=false;shotFeedback?.afterRender();
 });
 window.addEventListener('pagehide',()=>{audio.pause();music.pause();platform.setGameplay(false);});
}
boot().catch(error=>{console.error('Survival initialization failed',error);const button=document.querySelector('#start');button.disabled=false;button.querySelector('span').textContent='ПЕРЕЗАГРУЗИТЬ';button.onclick=()=>location.reload();document.querySelector('#menu-description').textContent='Не удалось запустить арену. Перезагрузи страницу и попробуй ещё раз.';});
