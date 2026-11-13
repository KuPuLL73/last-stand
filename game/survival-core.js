import {MAP,normalize2,movePlayer,segmentCircle,segmentBox,pelletDirections} from './logic.js';
import {CUBIC_VARIANTS,CUBIC_DEBUFFS,chooseCubicVariant} from './cubic-variants.js';
import {STEVE_WEAPONS,STEVE_START_WEAPON,getSteveWeapon,weaponStats} from './steve-weapons.js';
import {STEVE_SKILLS,STEVE_START_SKILL,getSteveSkill} from './steve-skills.js';
import {BONUS_DROPS,ENDLESS_BOSSES,ENDLESS_BOSS_ORDER,endlessPressure,endlessXpNeeded} from './endless-director.js';
import {UPGRADE_COMBINATIONS,combinationRank,getUpgradeCombination,isCombinationUnlocked} from './upgrade-combinations.js';

export const SURVIVAL_OBSTACLES=[
  {x:-4,z:2.8,w:2.1,d:1.25},{x:4,z:2,w:2.1,d:1.25},
  {x:0,z:-2,w:2.4,d:1.1},{x:-6.5,z:-5,w:1.4,d:2},
  {x:6.6,z:-5.1,w:1.45,d:2},
];

export const UPGRADE_DEFS=[
  {id:'damage',name:'Крупная дробь',nameEn:'Heavy pellets',description:'+22% к урону каждой дробинки.',descriptionEn:'+22% damage per pellet.',icon:'✹',max:5},
  {id:'rate',name:'Быстрые руки',nameEn:'Quick hands',description:'Выстрелы на 16% чаще.',descriptionEn:'Fire 16% faster.',icon:'»',max:5},
  {id:'pellets',name:'Больше дроби',nameEn:'More pellets',description:'+2 дробинки в каждом выстреле.',descriptionEn:'+2 pellets in every shot.',icon:'⁙',max:4},
  {id:'pierce',name:'Навылет',nameEn:'Piercing shot',description:'Каждая дробинка пробивает ещё одного врага.',descriptionEn:'Each pellet pierces one more enemy.',icon:'➤',max:3},
  {id:'ricochet',name:'Рикошет',nameEn:'Ricochet',description:'Дробь отскакивает от укрытий и границ арены.',descriptionEn:'Pellets bounce off cover and arena edges.',icon:'↝',max:3},
  {id:'burn',name:'Зажигательные',nameEn:'Incendiary rounds',description:'Попадания поджигают врага на 3 секунды.',descriptionEn:'Hits set enemies on fire for 3 seconds.',icon:'♨',max:4},
  {id:'speed',name:'Лёгкий шаг',nameEn:'Light feet',description:'+9% к скорости передвижения.',descriptionEn:'+9% movement speed.',icon:'↗',max:5},
  {id:'maxhp',name:'Крепкий орешек',nameEn:'Tough cookie',description:'+25 к максимуму здоровья и +30 здоровья сейчас.',descriptionEn:'+25 maximum health and heal 30 now.',icon:'♥',max:5},
  {id:'regen',name:'Второе дыхание',nameEn:'Second wind',description:'Восстанавливает 0,65 здоровья в секунду.',descriptionEn:'Restore 0.65 health per second.',icon:'✚',max:5},
  {id:'pickup',name:'Магнит добычи',nameEn:'Loot magnet',description:'+1 м к притяжению опыта и +8% получаемого опыта.',descriptionEn:'+1 m experience magnet range and +8% experience.',icon:'◇',max:5},
];
export const UPGRADES=UPGRADE_DEFS;

const STEVE_UPGRADES={
  damage:{name:'Острота',nameEn:'Sharpness',description:'+22% к урону оружия и стрел.',descriptionEn:'+22% sword and arrow damage.'},
  rate:{name:'Быстрые руки',nameEn:'Quick hands',description:'Удары оружием и выстрелы из лука на 16% чаще.',descriptionEn:'Sword swings and bow shots are 16% faster.'},
  pellets:{name:'Размашистый клинок',nameEn:'Sweeping edge',description:'+0,22 м к дальности и +12° к ширине взмаха. Лук стреляет дальше.',descriptionEn:'+0.22 m sword reach and +12° swing width. Bow range also increases.'},
  pierce:{name:'Отбрасывание',nameEn:'Knockback',description:'Оружие сильнее отбрасывает зомби. Стрела пробивает ещё одного врага.',descriptionEn:'Sword knocks zombies farther away. Arrows pierce one more enemy.'},
  ricochet:{name:'Обратный взмах',nameEn:'Return swing',description:'После удара — повторный взмах на 35% урона (+15% за ранг). Стрелы рикошетят.',descriptionEn:'A return swing deals 35% damage (+15% per rank). Arrows ricochet.'},
  burn:{name:'Заговор огня',nameEn:'Fire aspect',description:'Оружие и стрелы поджигают врагов на 3 секунды.',descriptionEn:'Sword and arrows set enemies on fire for 3 seconds.'},
};
const PUDGE_UPGRADES={
 damage:{name:'Тяжёлый тесак',description:'+22% к урону тесака и крюка.'},
 rate:{name:'Мясницкая сноровка',description:'Удары тесаком на 16% чаще.'},
 pellets:{name:'Широкая разделка',description:'+0,22 м к дальности и +12° к сектору тесака.'},
 pierce:{name:'Грубая сила',description:'Тесак сильнее отбрасывает врагов.'},
 ricochet:{name:'Второй удар',description:'Повторный взмах на 35% урона (+15% за ранг).'},
 burn:{name:'Грязный тесак',description:'Рана наносит дополнительный урон в течение 3 секунд.'},
 maxhp:{name:'Груда плоти',description:'+25 к максимуму здоровья и +30 здоровья сейчас.'},
 regen:{name:'Живучесть мясника',description:'Восстанавливает 0,65 здоровья в секунду.'},
};
const ROT_UPGRADE={id:'rot',name:'ROT · Гниение',nameEn:'Rot',description:'Открывает ядовитую ауру: 12 урона/с и −20% скорости врагов в радиусе 2,3 м. Следующие ранги: +4 урона/с и +0,2 м. Без самоурона.',max:5};

/** Shared upgrade ids keep builds stable, with weapon-specific player-facing text. */
export function getUpgradeDefs(character='shelly',weapon=STEVE_START_WEAPON){
  if(character==='pudge')return[ROT_UPGRADE,...UPGRADE_DEFS.map(u=>({...u,...PUDGE_UPGRADES[u.id]}))];
  if(character!=='steve')return UPGRADE_DEFS;
  const ranged=getSteveWeapon(weapon).attackMode==='ranged';
  const descriptions=ranged?{
    damage:{name:'Мощный выстрел',description:'+22% к урону снарядов.'},
    rate:{name:'Быстрая перезарядка',description:'Снаряды выпускаются на 16% чаще.',descriptionEn:'Fire projectiles 16% faster.'},
    pellets:{name:'Двойной выстрел',description:'Ещё один снаряд в залпе с 45% урона основного и +0,6 м к дальности.'},
    pierce:{name:'Пробивание',description:'Снаряд проходит ещё через одного врага.'},
    ricochet:{name:'Рикошет',description:'Снаряд отражается от препятствий ещё один раз.'},
    burn:{name:'Горящие снаряды',description:'Попадания поджигают врагов на 3 секунды.'},
  }:{};
  return UPGRADE_DEFS.map(u=>({...u,...STEVE_UPGRADES[u.id],...descriptions[u.id]}));
}

/** Includes the loadout's late-run combination for presentation and rank state. */
export function getRunUpgradeDefs(character='shelly', weapon=STEVE_START_WEAPON) {
  const base = getUpgradeDefs(character, weapon);
  const combo = getUpgradeCombination(character, weapon);
  return combo ? [...base, combo] : base;
}

const ENEMY_STATS={
  walker:{hp:54,speed:1.20,radius:.43,damage:9,xp:3},
  runner:{hp:40,speed:2.23,radius:.34,damage:7,xp:3},
  spitter:{hp:64,speed:1.12,radius:.46,damage:8,xp:5},
  creeper:{hp:48,speed:1.32,radius:.35,damage:0,xp:4},
  boss:{hp:1050,speed:.91,radius:1.1,damage:20,xp:30},
};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

/** Deterministic gameplay simulation. All timers are measured in active seconds. */
export class SurvivalRun{
  constructor({rng=Math.random,duration=240,obstacles=SURVIVAL_OBSTACLES,bounds=MAP,character='shelly',map='frontier',mode='campaign',weapon=STEVE_START_WEAPON,skill=STEVE_START_SKILL}={}){
    this.weaponId=getSteveWeapon(weapon).id;
    this.skillId=getSteveSkill(skill).id;
    this.rng=rng;this.duration=Math.max(.1,finite(duration,240));
    this.character=['steve','pudge'].includes(character)?character:'shelly';
    this.map=map==='cubic'?'cubic':'frontier';
    this.mode=mode==='endless'?'endless':'campaign';
    this.obstacles=obstacles.map(o=>({...o}));this.bounds={...bounds};
    this.restart();
  }

  restart(){
    this._nextId=1;this._events=[];this._spawnClock=3;this._resumePhase='playing';this._rotClock=0;this._nextBonusAt=0;this._hordeRank=1;
    this._combination = getUpgradeCombination(this.character, this.weaponId);
    const steve=this.character==='steve',pudge=this.character==='pudge',melee=steve||pudge;
    this.state={character:this.character,map:this.map,mode:this.mode,phase:'ready',elapsed:0,remaining:this.mode==='endless'?180:this.duration,nextBossAt:this.mode==='endless'?180:this.duration,wave:1,kills:0,level:1,xp:0,xpNeeded:9,
      enemies:[],projectiles:[],drops:[],warnings:[],choices:[],bossId:null,bossSequence:0,
      upgrades:Object.fromEntries(getRunUpgradeDefs(this.character,this.weaponId).map(u=>[u.id,0])),
      comboReadyAt:0,
      stats:{damageDealt:0,shots:0,pickups:0,bonuses:0,superUses:0,bosses:0},
      player:{character:this.character,x:0,z:6.8,radius:pudge?.52:.43,hp:pudge?160:steve?125:100,maxHp:pudge?160:steve?125:100,speed:pudge?3.8:4.6,super:100,
        superCooldown:0,invulnerable:0,aimX:0,aimZ:-1,angle:Math.PI,shots:0,
        cooldown:0,regen:0,pickupRadius:2.6,xpMultiplier:1,targetId:null,moving:false,
        buffs:{haste:0,rapid:0,shield:0},debuffs:{slow:0,poison:0},bowTime:0,skill:this.skillId,skillTime:0,dashTime:0,bulwarkTime:0,dash:null,pendingAttack:null,
        ...(pudge?{rot:{level:0,radius:0,dps:0,slow:0}}:{}),
        weapon:{type:pudge?'cleaver':steve?'sword':'shotgun',damage:pudge?55:steve?42:11,fireInterval:pudge?.9:steve?.72:.68,pellets:5,pierce:0,ricochet:0,burn:0,range:pudge?2.4:steve?2.7:8.6,spread:.36,...(melee?{arc:pudge?Math.PI*5/9:Math.PI*2/3,knockback:pudge?.5:.65,bowRange:10.5,hookRange:8}:{})}},
    };
    if(steve)Object.assign(this.state.player.weapon,weaponStats(this.weaponId));
    return this.state;
  }

  setWeapon(id){
    if(this.state.phase!=='ready'||!STEVE_WEAPONS.some(w=>w.id===id))return false;
    this.weaponId=id;this.restart();return true;
  }

  setSkill(id){
    if(this.state.phase!=='ready'||!STEVE_SKILLS.some(skill=>skill.id===id))return false;
    this.skillId=id;this.restart();return true;
  }

  setCharacter(character){
    if(this.state.phase!=='ready'||!['steve','shelly','pudge'].includes(character))return false;
    this.character=character;this.restart();return true;
  }

  setMode(mode){
    if(this.state.phase!=='ready'||!['campaign','endless'].includes(mode))return false;
    this.mode=mode;this.restart();return true;
  }

  start(){
    if(this.state.phase!=='ready')return false;
    this.state.phase='playing';
    // Early enemies are close enough to see and engage without spawning on top.
    const p=this.state.player;
    for(let i=0;i<3;i++){
      const angle=-Math.PI*.43+i*Math.PI*.43,distance=5.5+(i%2)*.75;
      this._spawnEnemy('walker',p.x+Math.sin(angle)*distance,p.z-Math.cos(angle)*distance,null);
    }
    return true;
  }
  pause(){
    if(!['playing','upgrade'].includes(this.state.phase))return false;
    this._resumePhase=this.state.phase;this.state.phase='paused';return true;
  }
  resume(){if(this.state.phase!=='paused')return false;this.state.phase=this._resumePhase;return true;}
  retire(){
    const s=this.state;
    if(!['playing','paused','upgrade'].includes(s.phase))return false;
    s.phase='retired';s.choices=[];s.player.pendingAttack=null;s.player.bowTime=0;s.player.skillTime=s.player.dashTime=s.player.bulwarkTime=0;s.player.dash=null;
    this._event('runend',{reason:'retired',mode:s.mode,elapsed:s.elapsed,kills:s.kills,level:s.level,bosses:s.stats.bosses});
    return true;
  }
  drainEvents(){const events=this._events;this._events=[];return events;}
  _event(type,data={}){this._events.push({...data,type});}
  _random(){return clamp(finite(this.rng(),.5),0,.999999999);}
  _id(){return this._nextId++;}

  update(dt,input={}){
    if(this.state.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    // Substeps preserve projectile/collision behavior even on slower displays.
    let remaining=Math.min(dt,.25),superRequested=Boolean(input.super);
    while(remaining>1e-8&&this.state.phase==='playing'){
      const step=Math.min(remaining,1/60);
      this._step(step,{x:finite(input.x),z:finite(input.z),super:superRequested});
      superRequested=false;remaining-=step;
    }
  }

  _step(dt,input){
    const s=this.state,p=s.player;
    s.elapsed+=dt;s.remaining=Math.max(0,(this.mode==='endless'?s.nextBossAt:this.duration)-s.elapsed);
    const wave=1+Math.floor(s.elapsed/30);
    if(wave!==s.wave){s.wave=wave;this._event('wave',{wave});}
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.cooldown=Math.max(0,p.cooldown-dt);
    p.superCooldown=Math.max(0,p.superCooldown-dt);p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
    p.bowTime=Math.max(0,p.bowTime-dt);
    p.bulwarkTime=Math.max(0,p.bulwarkTime-dt);p.skillTime=Math.max(0,p.skillTime-dt);
    for(const id of ['haste','rapid','shield'])p.buffs[id]=Math.max(0,p.buffs[id]-dt);
    this._updateDebuffs(dt);

    const movement=normalize2(input.x,input.z);p.moving=Math.hypot(movement.x,movement.z)>.08;p.moveX=movement.x;p.moveZ=movement.z;
    const speed=p.speed*(p.buffs.haste>0?1.35:1)*(p.debuffs.slow>0?1-CUBIC_DEBUFFS.slow.strength:1);
    const destination=movePlayer(p,movement.x*speed*dt*(p.dashTime>0?0:1),movement.z*speed*dt*(p.dashTime>0?0:1),p.radius,this.obstacles,this.bounds);
    p.x=destination.x;p.z=destination.z;
    if(input.super&&p.character!=='shelly')this._super();
    this._updateSteveSkill(dt);
    const target=this._nearestVisible();p.targetId=target?.id??null;
    if(p.dashTime>0&&p.dash){p.aimX=p.dash.dx;p.aimZ=p.dash.dz;}
    else if(p.character!=='shelly'&&p.pendingAttack&&p.bowTime<=0){p.aimX=p.pendingAttack.dx;p.aimZ=p.pendingAttack.dz;}
    else if(target){const d=Math.hypot(target.x-p.x,target.z-p.z)||1;p.aimX=(target.x-p.x)/d;p.aimZ=(target.z-p.z)/d;}
    else if(p.moving){const n=Math.hypot(movement.x,movement.z)||1;p.aimX=movement.x/n;p.aimZ=movement.z/n;}
    p.angle=Math.atan2(p.aimX,p.aimZ);
    if(input.super&&p.character==='shelly')this._super();
    if(s.phase!=='playing')return;
    this._updateMelee(dt);
    this._updateRot(dt);
    if(s.phase!=='playing')return;
    if(target&&p.cooldown<=0&&p.dashTime<=0){
      if(p.character!=='shelly'){if(p.character==='steve'&&p.bowTime>0)this._shootArrow(target);else if(p.weapon.attackMode==='ranged')this._shootRanged(target);else if(!p.pendingAttack&&p.dashTime<=0)this._swing();}
      else this._shoot(target);
    }
    this._updateEnemies(dt);
    if(s.phase!=='playing')return;
    this._updateProjectiles(dt);
    if(s.phase!=='playing')return;
    this._updateWarnings(dt);
    if(s.phase!=='playing')return;
    this._updateDrops(dt);
    if(s.phase!=='playing')return;

    if(this.mode==='endless'){
      if(s.elapsed+1e-8>=s.nextBossAt){
        if(s.bossId===null)this._spawnBoss();
        // The 180, 300, 420... active-second schedule is fixed. A boss still
        // alive at a later deadline replaces that slot; overdue bosses never
        // pile up or spawn back-to-back after a slow fight.
        s.nextBossAt=180+(Math.floor(Math.max(0,s.elapsed+1e-8-180)/120)+1)*120;
        s.remaining=Math.max(0,s.nextBossAt-s.elapsed);
      }
    }else if(s.elapsed>=this.duration&&s.bossId===null)this._spawnBoss();
    this._spawnClock-=dt;
    const director=this.map==='cubic'?endlessPressure(s.elapsed,s.stats.bosses):null;
    if(director)this._evolveHorde(director);
    const maxAlive=director?.maxAlive||60;
    if(this._spawnClock<=0&&s.enemies.length<maxAlive){
      const interval=director?director.spawnInterval*(s.bossId!==null?1.25:1):Math.max(.36,1.65-s.elapsed*.0054);
      this._spawnClock+=interval;
      const extra=director?director.extraSpawnChance:s.elapsed>120?.35:0;
      const batch=extra>0&&this._random()<extra?2:1;
      for(let i=0;i<batch&&s.enemies.length<maxAlive;i++){
        const r=this._random();
        // Limit ranged pressure even after the ground horde fills up.
        const ranged=s.enemies.reduce((n,e)=>n+(e.hp>0&&e.type==='spitter'?1:0),0);
        const type=this.map==='cubic'&&s.elapsed>50&&r>.82?'creeper':s.elapsed>40&&r<.17&&(!director||ranged<6)?'spitter':s.elapsed>20&&r<.35?'runner':'walker';
        this._spawnEnemy(type);
      }
    }
    // Keep the live arrays compact, with no dead objects accumulating over runs.
    s.enemies=s.enemies.filter(e=>e.hp>0);
  }

  _nearestVisible(){
    const p=this.state.player;let closest=null,nearest=p.character!=='shelly'?(p.bowTime>0?Math.max(p.weapon.bowRange,p.weapon.attackMode==='ranged'?p.weapon.range:0):p.weapon.range):p.weapon.range+.65;
    for(const enemy of this.state.enemies){
      if(enemy.hp<=0)continue;
      const d=Math.hypot(enemy.x-p.x,enemy.z-p.z);
      if(d>=nearest)continue;
      if(this.obstacles.some(box=>segmentBox(p.x,p.z,enemy.x,enemy.z,box)!==null))continue;
      closest=enemy;nearest=d;
    }
    return closest;
  }

  _evolveHorde(director){
    if(director.tier<=this._hordeRank)return;
    this._hordeRank=director.tier;
    for(const e of this.state.enemies){
      if(e.type==='boss'||e.hp<=0||e.rank>=director.tier)continue;
      const hpRatio=director.hp/(e.growthHp||1),scaleRatio=(1+(director.tier-1)*.045)/(1+((e.rank||1)-1)*.045);
      e.hp*=hpRatio;e.maxHp*=hpRatio;
      e.damage=Math.min(35,e.damage*director.damage/(e.growthDamage||1));
      e.speed=Math.min(3,e.speed*director.speed/(e.growthSpeed||1));
      e.radius*=scaleRatio;e.modelScale=(e.modelScale||1)*scaleRatio;
      e.rank=director.tier;e.growthHp=director.hp;e.growthDamage=director.damage;e.growthSpeed=director.speed;
    }
    this._event('horderank',{rank:director.tier,hp:director.hp});
  }

  _swing(){
    const s=this.state,p=s.player,w=p.weapon;
    p.cooldown=w.fireInterval*(p.buffs.rapid>0?.6:1);p.shots++;s.stats.shots++;
    // Preserve the facing of the committed swing while allowing movement.
    const heavy=p.character==='pudge',baseDuration=heavy?.55:.43,baseImpact=heavy?.18:.14,duration=Math.min(baseDuration,Math.max(.14,p.cooldown*.9)),impactDelay=baseImpact*duration/baseDuration;
    p.pendingAttack={remaining:impactDelay,dx:p.aimX,dz:p.aimZ,range:w.range,arc:w.arc,echo:false};
    this._event('melee',{character:p.character,weapon:w.type,x:p.x,z:p.z,dx:p.aimX,dz:p.aimZ,angle:p.angle,range:w.range,arc:w.arc,interval:p.cooldown,duration,impactDelay});
  }

  _updateMelee(dt){
    const s=this.state,p=s.player,attack=p.pendingAttack;
    if(!attack)return;
    attack.remaining-=dt;if(attack.remaining>1e-8)return;
    p.pendingAttack=null;
    if(p.character==='shelly'||p.bowTime>0||p.hp<=0)return;
    const w=p.weapon,multiplier=attack.echo?.20+w.ricochet*.15:1;
    const combo = attack.echo ? this._readyCombinationRank('echo-wave') : undefined;
    let echoKill;
    this._event('meleeimpact',{character:p.character,x:p.x,z:p.z,dx:attack.dx,dz:attack.dz,angle:Math.atan2(attack.dx,attack.dz),range:attack.range,arc:attack.arc,echo:attack.echo});
    for(const enemy of s.enemies){
      if(enemy.hp<=0)continue;
      const dx=enemy.x-p.x,dz=enemy.z-p.z,d=Math.hypot(dx,dz)||.001;
      if(d>attack.range+enemy.radius*.35||(dx*attack.dx+dz*attack.dz)/d<Math.cos(attack.arc/2))continue;
      if(this.obstacles.some(box=>segmentBox(p.x,p.z,enemy.x,enemy.z,box)!==null))continue;
      this._damageEnemy(enemy,w.damage*multiplier,p.character==='pudge'?'cleaver':'sword');
      if(enemy.hp>0){
        if(w.burn>0)this._setBurn(enemy,4+w.burn*4);
        const force=(w.knockback+w.pierce*.25)*(enemy.type==='boss'?.35:1)*(attack.echo?.5:1);
        const destination=movePlayer(enemy,dx/d*force,dz/d*force,enemy.radius,this.obstacles,this.bounds);
        enemy.x=destination.x;enemy.z=destination.z;enemy.stun=Math.max(enemy.stun,.12);
      } else if (combo && !echoKill) echoKill = enemy;
      if(s.phase!=='playing')break;
    }
    if (echoKill && s.phase === 'playing') this._emitEchoWave(echoKill, combo);
    if(!attack.echo&&w.ricochet>0&&s.phase==='playing')p.pendingAttack={...attack,remaining:.15,echo:true};
  }

  _updateRot(dt){
    const s=this.state,p=s.player,rot=p.rot;
    for(const e of s.enemies)e.rotSlow=0;
    if(!rot?.level||s.phase!=='playing')return;
    const affected=s.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<=rot.radius&&!this.obstacles.some(b=>segmentBox(p.x,p.z,e.x,e.z,b)!==null));
    for(const e of affected)e.rotSlow=rot.slow;
    this._rotClock-=dt;if(this._rotClock>0)return;this._rotClock+=.4;
    for(const e of affected){this._damageEnemy(e,rot.dps*.4,'rot',false);e.flash=Math.max(e.flash,.055);if(s.phase!=='playing')break;}
    this._event('rotpulse',{x:p.x,z:p.z,radius:rot.radius,level:rot.level,hits:affected.length});
  }

  _shootArrow(target){
    const s=this.state,p=s.player,w=p.weapon,ranged=w.attackMode==='ranged';
    const normalCooldown=Math.max(.22,w.fireInterval*(p.buffs.rapid>0?.6:1));
    // A ranged loadout gains the same proportional tempo bonus regardless of
    // its base speed; a slow crossbow cannot erase its entire reload drawback.
    p.cooldown=ranged?Math.max(.18,normalCooldown*.70):Math.max(.40,.80*Math.pow(.84,s.upgrades.rate)*(p.buffs.rapid>0?.6:1));p.shots++;s.stats.shots++;
    const advance=Math.min(.58,Math.hypot(target.x-p.x,target.z-p.z)*.4);
    const x=p.x+p.aimX*advance,z=p.z+p.aimZ*advance;
    const extra=ranged?s.upgrades.pellets:0,range=Math.max(w.bowRange,ranged?w.range:0);
    for(let i=0;i<=extra&&s.projectiles.filter(b=>b.team==='player'&&b.life>0).length<100;i++){
      const angle=p.angle+(i===0?0:((i+1)>>1)*.11*(i%2?1:-1));
      s.projectiles.push({id:this._id(),team:'player',kind:'arrow',x,z,vx:Math.sin(angle)*24,vz:Math.cos(angle)*24,
        life:range/24,radius:.10,damage:w.damage*(ranged?1:.60)*(i===0?1:.45),pierce:w.pierce,bounces:w.ricochet,burn:w.burn,splashRadius:ranged?w.splashRadius:0,penetrationFalloff:w.penetrationFalloff,effect:w.effect,slowDuration:w.slowDuration,slowStrength:w.slowStrength,hitIds:[]});
    }
    this._event('bowshot',{x,z,dx:p.aimX,dz:p.aimZ,angle:p.angle});
  }

  _shootRanged(target){
    const s=this.state,p=s.player,w=p.weapon,speed=w.projectileSpeed||24;
    p.cooldown=Math.max(.22,w.fireInterval*(p.buffs.rapid>0?.6:1));p.shots++;s.stats.shots++;
    const x=p.x+p.aimX*.55,z=p.z+p.aimZ*.55,extra=s.upgrades.pellets||0;
    for(let i=0;i<=extra&&s.projectiles.filter(b=>b.team==='player'&&b.life>0).length<100;i++){
      const angle=Math.atan2(p.aimX,p.aimZ)+(i===0?0:((i+1)>>1)*.11*(i%2?1:-1));
      s.projectiles.push({id:this._id(),team:'player',kind:w.rangedKind||'arrow',x,z,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,
        life:w.range/speed,radius:w.projectileRadius||.10,damage:w.damage*(i===0?1:.45),pierce:w.pierce,bounces:w.ricochet,burn:w.burn,splashRadius:w.splashRadius||0,penetrationFalloff:w.penetrationFalloff,effect:w.effect,slowDuration:w.slowDuration,slowStrength:w.slowStrength,hitIds:[]});
    }
    this._event('rangedshot',{x,z,dx:p.aimX,dz:p.aimZ,angle:p.angle,kind:w.rangedKind,weaponId:this.weaponId,interval:p.cooldown});
  }

  _updateSteveSkill(dt){
    const s=this.state,p=s.player,dash=p.dash;
    if(p.character!=='steve'||!dash||p.dashTime<=0)return;
    const step=Math.min(dt,p.dashTime),before={x:p.x,z:p.z};
    const next=movePlayer(p,dash.dx*dash.speed*step,dash.dz*dash.speed*step,p.radius,this.obstacles,this.bounds);
    p.x=next.x;p.z=next.z;p.moving=true;p.aimX=dash.dx;p.aimZ=dash.dz;p.angle=Math.atan2(dash.dx,dash.dz);
    for(const e of s.enemies){
      if(e.hp<=0||dash.hitIds.includes(e.id))continue;
      if(segmentCircle(before.x,before.z,next.x,next.z,e.x,e.z,e.radius+.8)===null)continue;
      dash.hitIds.push(e.id);this._damageEnemy(e,Math.min(110,p.weapon.damage*1.4),'dash');e.stun=Math.max(e.stun,.5);
      if(s.phase!=='playing')break;
    }
    p.dashTime=Math.max(0,p.dashTime-step);
    if(p.dashTime<=0||Math.hypot(next.x-before.x,next.z-before.z)<dash.speed*step*.15){
      p.dashTime=0;p.skillTime=0;p.dash=null;this._event('dashend',{x:p.x,z:p.z,dx:dash.dx,dz:dash.dz});
    }
  }

  _shoot(target){
    const s=this.state,p=s.player,w=p.weapon;
    p.cooldown=w.fireInterval*(p.buffs.rapid>0?.6:1);p.shots++;s.stats.shots++;
    const advance=Math.min(.66,Math.hypot(target.x-p.x,target.z-p.z)*.4);
    const x=p.x+p.aimX*advance,z=p.z+p.aimZ*advance;
    const comboVolley = s.upgrades['shrapnel-line'] > 0 ? {hits: Object.create(null), triggered: false} : null;
    for(const direction of pelletDirections(p.aimX,p.aimZ,w.pellets,w.spread)){
      s.projectiles.push({id:this._id(),team:'player',x,z,vx:direction.x*30,vz:direction.z*30,
        life:w.range/30,radius:.07,damage:w.damage,pierce:w.pierce,bounces:w.ricochet,burn:w.burn,hitIds:[],
        ...(comboVolley ? {comboVolley} : {})});
    }
    this._event('shot',{x,z,dx:p.aimX,dz:p.aimZ,angle:p.angle,pellets:w.pellets});
  }

  _super(){
    const s=this.state,p=s.player;
    if(p.super<100||p.superCooldown>0||p.bowTime>0||p.skillTime>0)return false;
    if(p.character==='pudge'){
      let target=null,nearest=p.weapon.hookRange;
      for(const e of s.enemies){const d=Math.hypot(e.x-p.x,e.z-p.z);if(e.hp>0&&d<nearest&&!this.obstacles.some(b=>segmentBox(p.x,p.z,e.x,e.z,b)!==null)){target=e;nearest=d;}}
      if(!target){this._event('abilityempty',{ability:'hook'});return false;}
      const dx=(target.x-p.x)/(nearest||1),dz=(target.z-p.z)/(nearest||1),targetX=target.x,targetZ=target.z;
      p.super=0;p.superCooldown=.65;p.cooldown=Math.max(p.cooldown,.45);p.pendingAttack=null;p.aimX=dx;p.aimZ=dz;s.stats.superUses++;
      this._damageEnemy(target,80*(p.weapon.damage/55),'hook');
      if(target.hp>0&&target.type!=='boss'){const end=movePlayer(target,p.x+dx*1.6-target.x,p.z+dz*1.6-target.z,target.radius,this.obstacles,this.bounds);target.x=end.x;target.z=end.z;target.stun=.5;}
      this._event('hook',{x:p.x,z:p.z,targetX,targetZ,dx,dz,targetId:target.id,hitX:target.x,hitZ:target.z,boss:target.type==='boss'});return true;
    }
    if(p.character==='steve'){
      const skill=getSteveSkill(this.skillId);
      p.super=0;p.superCooldown=skill.cooldown;p.skillTime=skill.duration;p.pendingAttack=null;p.cooldown=0;s.stats.superUses++;
      if(skill.id==='bow')p.bowTime=skill.duration;
      else if(skill.id==='dash'){
        const moving=Math.hypot(p.moveX||0,p.moveZ||0)>.1,direction=normalize2(moving?p.moveX:p.aimX,moving?p.moveZ:p.aimZ);
        p.dashTime=skill.duration;p.dash={dx:direction.x,dz:direction.z,speed:(skill.distance||5)/skill.duration,hitIds:[]};p.invulnerable=Math.max(p.invulnerable,skill.duration+.1);
        p.aimX=direction.x;p.aimZ=direction.z;p.angle=Math.atan2(direction.x,direction.z);
      }else if(skill.id==='bulwark'){p.bulwarkTime=skill.duration;p.debuffs.slow=p.debuffs.poison=0;}
      this._event('super',{character:'steve',ability:skill.id,duration:skill.duration,x:p.x,z:p.z,dx:p.aimX,dz:p.aimZ});return true;
    }
    p.super=0;p.superCooldown=.7;s.stats.superUses++;
    p.cooldown=Math.max(p.cooldown,.34);
    this._event('super',{x:p.x,z:p.z,dx:p.aimX,dz:p.aimZ,radius:7.5,ability:'shotgun'});
    for(const e of s.enemies){
      if(e.hp<=0)continue;
      const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz)||.001;
      if(d>7.5||(dx*p.aimX+dz*p.aimZ)/d<.40)continue;
      if(this.obstacles.some(box=>segmentBox(p.x,p.z,e.x,e.z,box)!==null))continue;
      this._damageEnemy(e,110+p.weapon.damage*3,'super');
      const destination=movePlayer(e,dx/d*2.8,dz/d*2.8,e.radius,this.obstacles,this.bounds);
      e.x=destination.x;e.z=destination.z;e.stun=.7;
    }
    // Nearby enemy projectiles are swept away by the blast as well.
    s.projectiles=s.projectiles.filter(b=>b.team==='player'||Math.hypot(b.x-p.x,b.z-p.z)>5||((b.x-p.x)*p.aimX+(b.z-p.z)*p.aimZ)/(Math.hypot(b.x-p.x,b.z-p.z)||1)<.40);
    return true;
  }

  _spawnEnemy(type,x,z,variant,options={}){
    const s=this.state,stats=ENEMY_STATS[type],b=this.bounds;
    // Explicit null permits controlled base-creature previews/tests; normal
    // spawns roll only in the endless cubic map, after the first full wave.
    const cleared=s.stats.bosses,variantsEnabled=this.mode==='endless'&&this.map==='cubic';
    if(variant===undefined)variant=variantsEnabled&&cleared>=1&&['walker','runner','spitter'].includes(type)?chooseCubicVariant(type,cleared,this._random(),s.enemies.filter(e=>e.hp>0&&e.variant).map(e=>e.variant)):null;
    const candidate=variantsEnabled&&CUBIC_VARIANTS[variant],definition=candidate?.type===type&&candidate.minBosses<=cleared?candidate:null;
    if(x===undefined){
      for(let i=0;i<25;i++){
        const side=Math.floor(this._random()*4),along=this._random();
        x=side<2?(side===0?b.minX+.7:b.maxX-.7):b.minX+.7+along*(b.maxX-b.minX-1.4);
        z=side>=2?(side===2?b.minZ+.7:b.maxZ-.7):b.minZ+.7+along*(b.maxZ-b.minZ-1.4);
        if(Math.hypot(x-s.player.x,z-s.player.z)>6.5)break;
      }
      if(Math.hypot(x-s.player.x,z-s.player.z)<4){x=s.player.x>0?b.minX+.8:b.maxX-.8;z=s.player.z>0?b.minZ+.8:b.maxZ-.8;}
    }
    const endless=this.mode==='endless',pressure=endless?Math.min(s.elapsed,1200):s.elapsed;
    const director=this.map==='cubic'?endlessPressure(s.elapsed,s.stats.bosses):null;
    const hp=type==='boss'?(stats.hp+Math.max(0,(endless?Math.min(s.level,30):s.level)-6)*30)*(endless?1+Math.min(8,s.stats.bosses)*.22:1):director?stats.hp*director.hp:stats.hp+pressure*(type==='spitter'?.055:.042);
    const variantHp=hp*(definition?.hp||1),rank=type==='boss'?1:director?.tier||1,rankScale=1+(rank-1)*.045;
    const e={id:this._id(),type,...(definition?{variant}:{}),x,z,hp:variantHp,maxHp:variantHp,radius:stats.radius*(definition?.radius||1),speed:Math.min(3,stats.speed*(director?.speed||1+Math.min(.25,pressure/1900))*(definition?.speed||1)),
      damage:Math.min(35,stats.damage*(director?.damage||(endless?1+Math.min(.75,Math.max(0,s.elapsed-180)/1800):1))*(definition?.damage||1)),xp:definition?.xp||stats.xp,angle:0,flash:0,attackCooldown:type==='boss'?2.2:1.6+this._random()*1.6,
      volleyCooldown:6,summonCooldown:6,abilityCooldown:2.5,teleportCooldown:2,harmlessUntil:0,burn:0,burnDps:0,stun:0,steerTime:0,steerSide:this._random()<.5?-1:1,age:0,
      rank,modelScale:rankScale,growthHp:director?.hp||1,growthDamage:director?.damage||1,growthSpeed:director?.speed||1};
    e.radius*=rankScale;
    if(definition?.flying)e.flying=true;
    if(definition?.split){
      e.splitGeneration=Math.max(0,Math.min(2,options.splitGeneration||0));const splitScale=Math.pow(.62,e.splitGeneration);e.modelScale*=splitScale;
      e.radius*=splitScale;e.hp*=Math.pow(.58,e.splitGeneration);e.maxHp=e.hp;e.damage*=Math.pow(.82,e.splitGeneration);
      e.splitFamilyId=options.splitFamilyId||e.id;
      if(e.splitGeneration>0){e.xp=0;e.rewardEligible=false;e.harmlessUntil=s.elapsed+.65;e.stun=.3;}
    }
    const valid=movePlayer(e,0,0,e.radius,e.flying?[]:this.obstacles,b);e.x=valid.x;e.z=valid.z;
    s.enemies.push(e);this._event('spawn',{id:e.id,enemyType:type,...(e.variant?{variant:e.variant}:{}),x:e.x,z:e.z});return e;
  }

  _spawnBoss(){
    const s=this.state;
    const active=s.enemies.find(e=>e.id===s.bossId&&e.hp>0);if(active)return active;
    if(s.enemies.length>=60){const index=s.enemies.findIndex(e=>e.type!=='boss');if(index>=0)s.enemies.splice(index,1);}
    const boss=this._spawnEnemy('boss',0,this.bounds.minZ+2);
    if(this.mode==='endless'&&this.map==='cubic'){
      const id=ENDLESS_BOSS_ORDER[s.bossSequence%ENDLESS_BOSS_ORDER.length],definition=ENDLESS_BOSSES[id];
      const growth=1+Math.min(.9,s.stats.bosses*.18),levelBonus=Math.max(0,Math.min(18,s.level-6))*18;
      Object.assign(boss,{bossVariant:id,bossName:definition.name,hp:definition.hp*growth+levelBonus,maxHp:definition.hp*growth+levelBonus,
        speed:definition.speed,damage:Math.min(30,definition.damage*(1+Math.min(.4,s.stats.bosses*.06))),radius:definition.radius,xp:definition.xp,cycle:1+Math.floor(s.bossSequence/ENDLESS_BOSS_ORDER.length),reinforced:false,flying:['wither','elder-guardian','ender-dragon'].includes(id)});
      s.bossSequence++;
      const valid=movePlayer(boss,0,0,boss.radius,boss.flying?[]:this.obstacles,this.bounds);boss.x=valid.x;boss.z=valid.z;
    }
    boss.bossSchedule=[];boss.bossPhase=1;boss.bossPattern=0;
    s.bossId=boss.id;this._event('boss',{id:boss.id,x:boss.x,z:boss.z,hp:boss.hp,...(boss.bossVariant?{bossVariant:boss.bossVariant,name:boss.bossName}:{})});
    return boss;
  }

  _walkEnemy(e,dx,dz,dt){
    const hopping=CUBIC_VARIANTS[e.variant]?.split?(Math.sin(e.age*5.5)>.15?1.75:.55):1;
    const speed=e.speed*hopping*(1-(e.rotSlow||0))*(1-(e.slowTime>0?e.slowStrength||0:0))*dt,original={x:e.x,z:e.z};
    let direction={x:dx,z:dz};
    if(e.steerTime>0){direction=normalize2(dx*.35-dz*e.steerSide,dz*.35+dx*e.steerSide);e.steerTime-=dt;}
    const obstacles=e.flying?[]:this.obstacles;
    let next=movePlayer(e,direction.x*speed,direction.z*speed,e.radius,obstacles,this.bounds);
    if(Math.hypot(next.x-original.x,next.z-original.z)<speed*.36){
      e.steerTime=.55;
      const a=movePlayer(e,(-dz*e.steerSide+dx*.15)*speed,(dx*e.steerSide+dz*.15)*speed,e.radius,obstacles,this.bounds);
      const c=movePlayer(e,(dz*e.steerSide+dx*.15)*speed,(-dx*e.steerSide+dz*.15)*speed,e.radius,obstacles,this.bounds);
      const da=Math.hypot(a.x-e.x,a.z-e.z),dc=Math.hypot(c.x-e.x,c.z-e.z);
      if(dc>da*1.3){e.steerSide*=-1;next=c;}else next=a;
    }
    e.x=next.x;e.z=next.z;
  }

  _updateEnemies(dt){
    const s=this.state,p=s.player;
    for(const e of s.enemies){
      if(e.hp<=0)continue;
      e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.slowTime=Math.max(0,(e.slowTime||0)-dt);
      if(e.burn>0){
        const burnStep = e.burnCombo ? Math.min(dt, e.burn) : dt;
        e.burn -= dt;
        this._damageEnemy(e, e.burnDps * burnStep, e.burnCombo ? 'combo' : 'burn', false);
        if(e.hp<=0)continue;
      }
      if(e.charge?.remaining>0){this._updateBossCharge(e,dt);continue;}
      const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||.001;
      e.angle=Math.atan2(dx,dz);e.attackCooldown-=dt;e.volleyCooldown-=dt;e.abilityCooldown=Math.max(0,(e.abilityCooldown||0)-dt);e.teleportCooldown=Math.max(0,(e.teleportCooldown||0)-dt);e.summonCooldown=Math.max(0,(e.summonCooldown||0)-dt);
      const archetype=CUBIC_VARIANTS[e.variant];
      if(e.stun<=0){
        if(e.type==='creeper'){
          if(!e.fusing&&d<2.2){e.fusing=true;const warning={id:this._id(),type:'explode',sourceId:e.id,x:e.x,z:e.z,radius:2.5,remaining:1.1,duration:1.1,damage:24};s.warnings.push(warning);this._event('warning',{...warning,hazard:'explode'});}
          if(!e.fusing)this._walkEnemy(e,dx/d,dz/d,dt);
          continue;
        }
        const spitterStand=(e.type==='spitter'||e.bossVariant==='wither'||e.bossVariant==='elder-guardian'||e.bossVariant==='ender-dragon')&&d<(e.type==='boss'?6.7:5.7)&&!this.obstacles.some(b=>segmentBox(e.x,e.z,p.x,p.z,b)!==null);
        if(!(e.castUntil>s.elapsed)){
          if(!spitterStand&&d>e.radius+p.radius-.04)this._walkEnemy(e,dx/d,dz/d,dt);
          else if(spitterStand&&d<3)this._walkEnemy(e,-dx/d,-dz/d,dt);
        }
        if(e.type==='spitter'&&d<8&&e.attackCooldown<=0){
          if(archetype?.spell){
            e.attackCooldown=archetype.shotInterval||5;this._castMobSpell(e,archetype);
          }else{
            e.attackCooldown=(archetype?.shotInterval||(e.variant==='armored-skeleton'?3.1:2.5))+this._random()*.5;
            const options=archetype?.projectile?{kind:archetype.projectile,damage:archetype.shotDamage||10,effect:archetype.effect,colour:archetype.colour,knockback:archetype.knockback,y:e.flying?1.7:.9}:{};
            for(const v of pelletDirections(dx/d,dz/d,archetype?.shotCount||1,archetype?.shotCount>1?.4:0))this._enemyShot(e,v.x,v.z,4.5,options);
            this._event('enemyshot',{id:e.id,x:e.x,z:e.z});
          }
        }
        if(archetype?.charge&&e.abilityCooldown<=0&&d>3&&d<8&&!(e.castUntil>s.elapsed)){
          e.abilityCooldown=9;this._bossChargeWarning(e,dx/d,dz/d);
        }
        if(e.type==='boss'){
          if(e.bossVariant)this._updateEndlessBoss(e,dx/d,dz/d,d,dt);
          else{
            if(e.attackCooldown<=0){
              e.attackCooldown=3.5;
              const warning={id:this._id(),type:'slam',sourceId:e.id,x:p.x,z:p.z,radius:2.45,remaining:1.3,duration:1.3,damage:28};
              s.warnings.push(warning);this._event('warning',{...warning});
            }
            if(e.volleyCooldown<=0){e.volleyCooldown=7;for(const v of pelletDirections(dx/d,dz/d,7,1.7))this._enemyShot(e,v.x,v.z,4.3);this._event('enemyshot',{id:e.id,x:e.x,z:e.z,boss:true});}
          }
        }
      }
      if(s.elapsed>=(e.harmlessUntil||0)&&Math.hypot(p.x-e.x,p.z-e.z)<e.radius+p.radius+.055){
        const hurt=this._hurtPlayer(e.damage,e.x,e.z,'contact');
        if(hurt&&e.variant==='cave-spider')this._applyDebuff('poison',e.id);
      }
    }
    // Gentle separation prevents unreadable piles of bodies and contact bursts.
    for(let i=0;i<s.enemies.length;i++)for(let j=i+1;j<s.enemies.length;j++){
      const a=s.enemies[i],b=s.enemies[j];if(a.hp<=0||b.hp<=0)continue;
      let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=(a.radius+b.radius)*.84;
      if(d>=min)continue;
      if(d<.001){dx=.01;dz=.01;d=Math.hypot(dx,dz);}
      const push=Math.min((min-d)*.45,dt*1.5),ax=dx/d*push,az=dz/d*push;
      const pa=movePlayer(a,-ax,-az,a.radius,a.flying?[]:this.obstacles,this.bounds),pb=movePlayer(b,ax,az,b.radius,b.flying?[]:this.obstacles,this.bounds);
      a.x=pa.x;a.z=pa.z;b.x=pb.x;b.z=pb.z;
    }
  }

  _castMobSpell(enemy,definition){
    const guardian=definition.spell==='guardian';
    this._bossWarning(enemy,{radius:guardian?1.25:1.1,duration:guardian?1.6:1.2,damage:guardian?12:11,hazard:guardian?'guardian':'fangs',beam:guardian});
    if(definition.spell==='fangs'&&enemy.summonCooldown<=0&&this._canAddVariant('vex')){
      enemy.summonCooldown=12;let count=this.state.enemies.filter(e=>e.hp>0&&e.parentCasterId===enemy.id).length;
      for(let i=0;i<2&&count<3&&this.state.enemies.length<60;i++){
        const angle=enemy.age+i*Math.PI,x=enemy.x+Math.cos(angle)*2,z=enemy.z+Math.sin(angle)*2;
        if(Math.hypot(x-this.state.player.x,z-this.state.player.z)<3)continue;
        const child=this._spawnEnemy('runner',x,z,'vex');child.parentCasterId=enemy.id;child.harmlessUntil=this.state.elapsed+.6;count++;
      }
    }
  }

  _canAddVariant(variant){const active=new Set(this.state.enemies.filter(e=>e.hp>0&&e.variant).map(e=>e.variant));return active.size<8||active.has(variant);}

  _splitMob(enemy){
    const s=this.state,generation=enemy.splitGeneration||0;if(generation>=2||!this._canAddVariant(enemy.variant))return;
    s.enemies=s.enemies.filter(e=>e.hp>0);
    for(let i=0;i<2&&s.enemies.length<60;i++){
      const a=enemy.age+i*Math.PI;this._spawnEnemy(enemy.type,enemy.x+Math.cos(a)*.55,enemy.z+Math.sin(a)*.55,enemy.variant,{splitGeneration:generation+1,splitFamilyId:enemy.splitFamilyId||enemy.id});
    }
    this._event('split',{id:enemy.id,x:enemy.x,z:enemy.z,variant:enemy.variant,generation:generation+1});
  }

  _teleportMob(enemy){
    const s=this.state,fromX=enemy.x,fromZ=enemy.z;enemy.teleportCooldown=7;
    for(let i=0;i<8;i++){
      const a=this._random()*Math.PI*2,candidate={x:s.player.x+Math.cos(a)*6,z:s.player.z+Math.sin(a)*6};
      const point=movePlayer(candidate,0,0,enemy.radius,this.obstacles,this.bounds);
      if(Math.hypot(point.x-s.player.x,point.z-s.player.z)<4||Math.hypot(point.x-fromX,point.z-fromZ)<2)continue;
      enemy.x=point.x;enemy.z=point.z;enemy.stun=Math.max(enemy.stun,.45);enemy.harmlessUntil=s.elapsed+.6;
      this._event('teleport',{id:enemy.id,fromX,fromZ,x:enemy.x,z:enemy.z});break;
    }
  }

  _bossWarning(enemy,{radius,duration,damage,hazard,effect,beam=false}){
    const s=this.state,p=s.player;
    // Keep simultaneous telegraphs bounded and always leave an escape route.
    if(s.warnings.filter(w=>w.type!=='explode'&&w.remaining>0).length>=3)return;
    const warning={id:this._id(),type:'slam',sourceId:enemy.id,x:p.x,z:p.z,radius,remaining:duration,duration,damage,hazard,...(effect?{effect}:{}),...(beam?{beam:true,fromX:enemy.x,fromZ:enemy.z,fromY:enemy.bossVariant==='elder-guardian'?1.6:enemy.bossVariant==='warden'?1.9:2}:{})};
    enemy.castUntil=Math.max(enemy.castUntil||0,s.elapsed+duration);
    s.warnings.push(warning);this._event('warning',{...warning});
  }

  _updateEndlessBoss(enemy,dx,dz,distance,dt){
    const s=this.state;
    this._bossTickAbilities(enemy);
    this._bossReinforcements(enemy);
    if(enemy.castUntil>s.elapsed)return;
    if(enemy.bossVariant==='iron-golem'){
      if(enemy.attackCooldown<=0&&distance<4.6){
        enemy.attackCooldown=4.8;
        this._bossTelegraph(enemy,{ability:'golem-smash',x:enemy.x+dx*1.3,z:enemy.z+dz*1.3,radius:2.35,duration:1.45,damage:24,hazard:'stone',colour:'#d8b47c'});
      }else if(enemy.volleyCooldown<=0){
        enemy.volleyCooldown=8;
        // Three growing stone strikes travel along the original aim. The gaps
        // on either side stay open; following the player would erase them.
        for(let i=0;i<3;i++)this._bossTelegraph(enemy,{ability:'stone-wave',x:enemy.x+dx*(2.7+i*2.65),z:enemy.z+dz*(2.7+i*2.65),radius:1.3,duration:1.25+i*.38,damage:18,hazard:'stone',colour:'#d8b47c',sequence:i});
      }
    }else if(enemy.bossVariant==='wither'){
      if(enemy.volleyCooldown<=0){
        enemy.volleyCooldown=enemy.bossPhase===2?7:9;
        const p=s.player,count=enemy.bossPhase===2?3:2,side=(enemy.bossPattern++%2)?-1:1;
        for(let i=0;i<count;i++){
          const offset=count===2?i*3.6*side:(i-1)*3.6;
          this._bossTelegraph(enemy,{ability:'wither-bombardment',x:p.x-dz*offset,z:p.z+dx*offset,radius:1.5,duration:1.65+i*.18,damage:18,hazard:'wither',colour:'#95cae7',sequence:i});
        }
      }else if(enemy.attackCooldown<=0&&distance<15){
        enemy.attackCooldown=enemy.bossPhase===2?3.4:4.2;
        this._bossWindupVolley(enemy,{ability:'skull-volley',dx,dz,duration:.9,count:enemy.bossPhase===2?5:3,spread:enemy.bossPhase===2?.95:.55,speed:4.8,kind:'wither-skull',damage:11,colour:'#8fbbd3',y:2.3});
      }
    }else if(enemy.bossVariant==='warden'){
      if(enemy.volleyCooldown<=0&&distance<10){
        enemy.volleyCooldown=10;
        // The centre and the outside of each annulus are safe. Two separated
        // rings ask for a deliberate inward or outward dodge, not a DPS race.
        for(let i=0;i<2;i++)this._bossTelegraph(enemy,{ability:'sonic-ring',x:enemy.x,z:enemy.z,radius:4.6+i*2.4,innerRadius:3.45+i*2.4,shape:'ring',duration:1.55+i*.65,damage:19,hazard:'sonic',colour:'#55f4e6',sequence:i});
      }else if(enemy.attackCooldown<=0&&distance<15){
        enemy.attackCooldown=5.8;
        this._bossTelegraph(enemy,{ability:'sonic-boom',x:enemy.x+dx*14,z:enemy.z+dz*14,fromX:enemy.x,fromZ:enemy.z,fromY:1.9,shape:'line',width:.95,radius:.95,beam:true,duration:1.6,damage:23,hazard:'sonic',colour:'#55f4e6'});
      }
    }else if(enemy.bossVariant==='ender-dragon'){
      if(enemy.volleyCooldown<=0&&distance>4){
        enemy.volleyCooldown=11;
        this._bossChargeWarning(enemy,dx,dz,{ability:'dragon-flyby',length:Math.min(12,distance+3),duration:1.65,speed:10,width:2.8,damage:20,hazard:'dragon',colour:'#cb83f5'});
      }else if(enemy.attackCooldown<=0&&distance<16){
        enemy.attackCooldown=7.2;
        const p=s.player;
        for(let i=0;i<3;i++){
          const offset=(i-1)*3.7;
          this._bossTelegraph(enemy,{ability:'dragon-breath',x:p.x-dz*offset,z:p.z+dx*offset,radius:1.55,duration:1.65+i*.2,damage:12,hazard:'dragon',colour:'#bf6ce8',zoneDuration:3,zoneInterval:.8,zoneDamage:7,sequence:i});
        }
      }
    }else if(enemy.bossVariant==='zombie-brute'){
      if(enemy.volleyCooldown<=0&&distance>3&&distance<13){
        enemy.volleyCooldown=9.5;
        this._bossChargeWarning(enemy,dx,dz,{ability:'brute-charge',duration:1.35,length:Math.min(8.5,distance+1.8),width:2,damage:22,colour:'#e49e64'});
      }else if(enemy.attackCooldown<=0&&distance<4.8){
        enemy.attackCooldown=5.5;
        this._bossTelegraph(enemy,{ability:'brute-smash',x:enemy.x+dx,z:enemy.z+dz,radius:2.4,duration:1.35,damage:24,hazard:'stone',colour:'#e49e64'});
      }
    }else if(enemy.bossVariant==='elder-guardian'){
      if(enemy.attackCooldown<=0&&distance<16){
        enemy.attackCooldown=6.5;
        this._bossTelegraph(enemy,{ability:'guardian-beam',x:s.player.x,z:s.player.z,fromX:enemy.x,fromZ:enemy.z,fromY:1.6,shape:'line',width:.8,radius:.8,beam:true,duration:2.4,trackingUntil:s.elapsed+1.1,damage:18,effect:'slow',hazard:'guardian',colour:'#f6c65f'});
      }else if(enemy.volleyCooldown<=0&&distance<8){
        enemy.volleyCooldown=10;
        this._bossTelegraph(enemy,{ability:'guardian-pulse',x:enemy.x,z:enemy.z,shape:'ring',radius:4,innerRadius:2.8,duration:1.65,damage:16,hazard:'guardian',colour:'#f6c65f'});
      }
    }
  }

  _bossAbility(enemy,ability,stage,details={}){
    this._event('bossability',{id:enemy.id,bossVariant:enemy.bossVariant,ability,stage,x:enemy.x,z:enemy.z,...details});
  }

  _bossTelegraph(enemy,options){
    const s=this.state;
    if(s.warnings.filter(w=>w.remaining>0&&w.type!=='explode').length>=3)return null;
    const {ability,...details}=options;
    const warning={id:this._id(),type:'slam',shape:'circle',sourceId:enemy.id,bossVariant:enemy.bossVariant,bossAbility:ability,...details};
    warning.x=clamp(warning.x,this.bounds.minX+.3,this.bounds.maxX-.3);warning.z=clamp(warning.z,this.bounds.minZ+.3,this.bounds.maxZ-.3);
    warning.remaining=warning.duration;
    enemy.castUntil=Math.max(enemy.castUntil||0,s.elapsed+warning.duration);
    s.warnings.push(warning);this._event('warning',{...warning});
    this._bossAbility(enemy,ability,'windup',{...warning,warningId:warning.id,id:enemy.id});
    return warning;
  }

  _bossWindupVolley(enemy,options){
    const s=this.state;
    if((enemy.bossSchedule?.length||0)>=8)return;
    enemy.bossSchedule??=[];
    enemy.bossSchedule.push({type:'volley',at:s.elapsed+options.duration,...options});
    enemy.castUntil=Math.max(enemy.castUntil||0,s.elapsed+options.duration);
    this._bossAbility(enemy,options.ability,'windup',{...options,fromX:enemy.x,fromZ:enemy.z});
  }

  _bossTickAbilities(enemy){
    const s=this.state;
    if(enemy.hp<=0){enemy.bossSchedule=[];return;}
    if(enemy.bossPhase!==2&&enemy.hp<=enemy.maxHp*.5){
      enemy.bossPhase=2;
      this._bossAbility(enemy,'phase-change','phase',{phase:2,duration:.8});
    }
    for(const warning of s.warnings){
      if(warning.sourceId!==enemy.id||!warning.trackingUntil||warning.locked)continue;
      // Tracking is visible for 1.1 seconds. Once locked, both the origin and
      // target remain fixed for the entire final dodge window.
      warning.x=s.player.x;warning.z=s.player.z;
      if(s.elapsed>=warning.trackingUntil){warning.locked=true;this._bossAbility(enemy,warning.bossAbility,'lock',{...warning,warningId:warning.id,id:enemy.id});}
      else if(s.elapsed>=(warning.nextTrackEvent||0)){
        warning.nextTrackEvent=s.elapsed+.15;
        this._bossAbility(enemy,warning.bossAbility,'track',{...warning,warningId:warning.id,id:enemy.id});
      }
    }
    const scheduled=enemy.bossSchedule||[];enemy.bossSchedule=[];
    for(const action of scheduled){
      if(action.at>s.elapsed){enemy.bossSchedule.push(action);continue;}
      if(action.type==='volley'){
        for(const v of pelletDirections(action.dx,action.dz,action.count,action.spread))this._enemyShot(enemy,v.x,v.z,action.speed,{kind:action.kind,height:action.y,y:action.y,damage:action.damage,colour:action.colour});
        this._bossAbility(enemy,action.ability,'fire',{...action,fromX:enemy.x,fromZ:enemy.z});
        this._event('enemyshot',{id:enemy.id,x:enemy.x,z:enemy.z,boss:true,kind:action.kind});
      }
    }
  }

  _bossChargeWarning(enemy,dx,dz,options={}){
    const s=this.state,ordinary=enemy.type!=='boss',length=options.length??Math.min(ordinary?5.5:7.2,Math.hypot(s.player.x-enemy.x,s.player.z-enemy.z)+2),duration=options.duration??1.2,speed=options.speed??(ordinary?7:10);
    if(s.warnings.filter(w=>w.remaining>0&&w.type!=='explode').length>=3)return;
    const warning={id:this._id(),type:'charge',hazard:options.hazard||'charge',sourceId:enemy.id,fromX:enemy.x,fromZ:enemy.z,
      x:enemy.x+dx*length,z:enemy.z+dz*length,dx,dz,length,width:options.width??(ordinary?1.5:1.8),radius:ordinary?.75:.9,duration,remaining:duration,damage:options.damage??(ordinary?14:22),speed,
      ...(options.ability?{bossAbility:options.ability,bossVariant:enemy.bossVariant,colour:options.colour,travelDuration:length/speed}:{})};
    enemy.castUntil=s.elapsed+duration;s.warnings.push(warning);this._event('warning',{...warning});
    if(options.ability)this._bossAbility(enemy,options.ability,'windup',{...warning,warningId:warning.id,id:enemy.id});
  }

  _updateBossCharge(enemy,dt){
    const s=this.state,p=s.player,c=enemy.charge,before={x:enemy.x,z:enemy.z};
    const next=movePlayer(enemy,c.dx*c.speed*dt,c.dz*c.speed*dt,enemy.radius,enemy.flying?[]:this.obstacles,this.bounds);
    enemy.x=next.x;enemy.z=next.z;enemy.angle=Math.atan2(c.dx,c.dz);
    if(!c.hit&&segmentCircle(before.x,before.z,next.x,next.z,p.x,p.z,p.radius+enemy.radius*.7)!==null){
      c.hit=true;this._hurtPlayer(c.damage||22,enemy.x,enemy.z,'charge');
    }
    c.remaining=Math.max(0,c.remaining-dt);
    if(Math.hypot(next.x-before.x,next.z-before.z)<c.speed*dt*.35)c.remaining=0;
    if(c.remaining<=0){
      enemy.stun=Math.max(enemy.stun,.55);this._event('chargeend',{id:enemy.id,x:enemy.x,z:enemy.z});
      if(enemy.bossVariant==='zombie-brute')this._bossTelegraph(enemy,{ability:'brute-landing',x:enemy.x,z:enemy.z,radius:2.5,duration:1.2,damage:20,hazard:'stone',colour:'#e49e64'});
      if(enemy.bossVariant==='ender-dragon')this._bossAbility(enemy,'dragon-flyby','recover',{duration:.8});
    }
  }

  _bossReinforcements(enemy){
    const s=this.state;if(!(enemy.cycle>1)||enemy.reinforced||enemy.age<8)return;
    enemy.reinforced=true;
    const variant=enemy.bossVariant==='wither'?'armored-skeleton':enemy.bossVariant==='elder-guardian'?'drowned':enemy.bossVariant==='zombie-brute'?'husk':'armored-zombie';
    const type=CUBIC_VARIANTS[variant].type;if(!this._canAddVariant(variant)||(type==='spitter'&&s.enemies.filter(e=>e.hp>0&&e.type==='spitter').length>=6))return;
    const desired=Math.min(3,enemy.cycle-1),radius=ENEMY_STATS[type].radius*(CUBIC_VARIANTS[variant].radius||1);let count=0;
    for(let i=0;i<8&&count<desired&&s.enemies.length<60;i++){
      const a=i*Math.PI/4+enemy.age*.2,candidate={x:enemy.x+Math.cos(a)*2.5,z:enemy.z+Math.sin(a)*2.5};
      const point=movePlayer(candidate,0,0,radius,this.obstacles,this.bounds);
      if(Math.hypot(point.x-s.player.x,point.z-s.player.z)<3)continue;
      const child=this._spawnEnemy(type,point.x,point.z,variant);child.parentBossId=enemy.id;count++;
    }
    if(count)this._event('reinforcements',{id:enemy.id,bossVariant:enemy.bossVariant,count});
  }

  _enemyShot(enemy,dx,dz,speed,options={}){
    // A hard enemy-projectile budget protects long runs and weak devices.
    if(this.state.projectiles.filter(p=>p.team==='enemy'&&p.life>0).length>=80)return;
    this.state.projectiles.push({id:this._id(),team:'enemy',x:enemy.x+dx*(enemy.radius+.1),z:enemy.z+dz*(enemy.radius+.1),
      vx:dx*speed,vz:dz*speed,life:3,radius:enemy.type==='boss'?.19:.16,damage:enemy.type==='boss'?13:enemy.variant==='armored-skeleton'?14:10,sourceId:enemy.id,...(this.map==='cubic'&&enemy.type==='spitter'?{kind:'arrow',...(enemy.variant==='stray'?{effect:'slow'}:{})}:{}),...options});
  }

  _applyDebuff(id,sourceId){
    const p=this.state.player,definition=CUBIC_DEBUFFS[id];
    if(!definition||this.state.phase!=='playing'||p.buffs.shield>0||p.bulwarkTime>0)return false;
    p.debuffs[id]=Math.max(p.debuffs[id],definition.duration);
    this._event('debuff',{debuff:id,duration:definition.duration,sourceId});return true;
  }

  _updateDebuffs(dt){
    const p=this.state.player;
    if(p.buffs.shield>0||p.bulwarkTime>0){p.debuffs.slow=0;p.debuffs.poison=0;return;}
    // Poison refreshes a single timer, never stacks, and cannot deal the final
    // hit. Only direct enemy attacks can finish a poisoned one-health player.
    const poisoned=Math.min(dt,p.debuffs.poison);
    if(poisoned>0)p.hp=Math.max(1,p.hp-poisoned*CUBIC_DEBUFFS.poison.damagePerSecond);
    for(const id of ['slow','poison'])p.debuffs[id]=Math.max(0,p.debuffs[id]-dt);
  }

  _damageEnemy(enemy,damage,cause='pellet',flash=true){
    if(enemy.hp<=0||damage<=0)return;
    const actual=Math.min(enemy.hp,damage);enemy.hp=Math.max(0,enemy.hp-damage);
    this.state.stats.damageDealt+=actual;
    if(cause!=='super'&&cause!=='hook'&&cause!=='combo'&&this.state.player.bowTime<=0&&this.state.player.skillTime<=0)this.state.player.super=Math.min(100,this.state.player.super+actual*.105);
    if(flash){enemy.flash=.12;this._event('hit',{id:enemy.id,x:enemy.x,z:enemy.z,damage:Math.round(damage),cause,hp:enemy.hp,maxHp:enemy.maxHp});}
    if(enemy.hp<=0)this._killEnemy(enemy,cause);
    else if(CUBIC_VARIANTS[enemy.variant]?.teleport&&enemy.teleportCooldown<=0)this._teleportMob(enemy);
  }

  _killEnemy(enemy,cause){
    const s=this.state,reward=enemy.rewardEligible!==false;
    if(reward)s.kills++;
    if(reward&&cause!=='super'&&cause!=='hook'&&cause!=='combo'&&s.player.bowTime<=0&&s.player.skillTime<=0)s.player.super=Math.min(100,s.player.super+2);
    this._event('kill',{id:enemy.id,enemyType:enemy.type,x:enemy.x,z:enemy.z,xp:enemy.xp,cause});
    if(enemy.type==='boss'){
      s.stats.bosses++;
      if(this.mode!=='endless'){
        s.phase='won';s.choices=[];s.player.pendingAttack=null;s.player.bowTime=s.player.skillTime=s.player.dashTime=s.player.bulwarkTime=0;s.player.dash=null;this._event('win',{elapsed:s.elapsed,kills:s.kills,level:s.level});return;
      }
      s.bossId=null;
      this._event('bossdefeated',{id:enemy.id,bosses:s.stats.bosses,nextBossAt:s.nextBossAt,elapsed:s.elapsed});
    }
    if(CUBIC_VARIANTS[enemy.variant]?.split)this._splitMob(enemy);
    if(!reward)return;
    const drop={id:this._id(),x:enemy.x,z:enemy.z,value:enemy.xp,type:'xp',radius:.16};
    const experience=s.drops.filter(d=>d.type==='xp');
    if(experience.length>=85){
      let nearest=experience[0];for(const d of experience)if(Math.hypot(d.x-drop.x,d.z-drop.z)<Math.hypot(nearest.x-drop.x,nearest.z-drop.z))nearest=d;
      nearest.value+=drop.value;
    }else s.drops.push(drop);
    if(s.elapsed+1e-8>=this._nextBonusAt&&s.drops.filter(d=>d.type!=='xp'&&!d.collected&&(d.life??20)>0).length<BONUS_DROPS.maxActive&&this._random()<BONUS_DROPS.chance){
      this._nextBonusAt=s.elapsed+BONUS_DROPS.cooldown;
      // Wounded players have a better chance of finding medicine, but no
      // particular kill is forced to produce it.
      const pool=s.player.hp<s.player.maxHp*.5?['heal','heal','haste','rapid','shield','magnet']:['heal','haste','rapid','shield','magnet'];
      const type=pool[Math.floor(this._random()*pool.length)],b=this.bounds;
      s.drops.push({id:this._id(),type,x:clamp(enemy.x+(this._random()-.5)*.5,b.minX+.35,b.maxX-.35),
        z:clamp(enemy.z+(this._random()-.5)*.5,b.minZ+.35,b.maxZ-.35),value:0,radius:.30,life:20});
    }
  }

  _hurtPlayer(damage,x,z,cause){
    const s=this.state,p=s.player;if(p.invulnerable>0||p.buffs.shield>0||p.bulwarkTime>0||s.phase!=='playing')return false;
    p.hp=Math.max(0,p.hp-damage);p.invulnerable=.72;
    this._event('hurt',{damage,x,z,cause,hp:p.hp});
    if(p.hp<=0){s.phase='dead';s.choices=[];p.pendingAttack=null;p.bowTime=p.skillTime=p.dashTime=p.bulwarkTime=0;p.dash=null;this._event('lose',{elapsed:s.elapsed,kills:s.kills,level:s.level});}
    return true;
  }

  _updateProjectiles(dt){
    const s=this.state,p=s.player;
    for(const shot of s.projectiles){
      if(shot.life<=0)continue;
      const nx=shot.x+shot.vx*dt,nz=shot.z+shot.vz*dt;
      let target=null,best=1,cover=null;
      if(shot.team==='player'){
        for(const enemy of s.enemies){
          if(enemy.hp<=0||shot.hitIds.includes(enemy.id))continue;
          const hit=segmentCircle(shot.x,shot.z,nx,nz,enemy.x,enemy.z,enemy.radius+shot.radius);
          if(hit!==null&&hit<best){best=hit;target=enemy;}
        }
      }else{
        const hit=segmentCircle(shot.x,shot.z,nx,nz,p.x,p.z,p.radius+shot.radius);
        if(hit!==null&&hit<best){best=hit;target=p;}
      }
      for(const box of this.obstacles){const hit=segmentBox(shot.x,shot.z,nx,nz,box);if(hit!==null&&hit<=best){best=hit;cover=box;target=null;}}
      shot.x+=(nx-shot.x)*best;shot.z+=(nz-shot.z)*best;shot.life-=dt;
      if(target){
        if(shot.team==='enemy'&&p.bulwarkTime>0){
          const source=s.enemies.find(e=>e.id===shot.sourceId&&e.hp>0),speed=Math.max(12,Math.hypot(shot.vx,shot.vz));
          const direction=source?normalize2(source.x-p.x,source.z-p.z):normalize2(-shot.vx,-shot.vz);
          Object.assign(shot,{team:'player',vx:direction.x*speed,vz:direction.z*speed,damage:Math.min(65,shot.damage*1.8),life:1.6,hitIds:[],pierce:0,bounces:0,burn:0,effect:null,reflected:true});
          shot.x=p.x+direction.x*.8;shot.z=p.z+direction.z*.8;
          this._event('reflect',{x:shot.x,z:shot.z,dx:direction.x,dz:direction.z});
        }else if(shot.team==='enemy'){const hurt=this._hurtPlayer(shot.damage,shot.x,shot.z,'projectile');if(hurt&&shot.effect)this._applyDebuff(shot.effect,shot.sourceId);if(hurt&&shot.knockback){const n=Math.hypot(shot.vx,shot.vz)||1,dest=movePlayer(p,shot.vx/n*shot.knockback,shot.vz/n*shot.knockback,p.radius,this.obstacles,this.bounds);p.x=dest.x;p.z=dest.z;}shot.life=0;}
        else{
          if (shot.comboVolley && shot.pierce > 0) this._tryShrapnel(shot, target);
          this._damageEnemy(target,shot.damage,shot.comboSource?'combo':shot.kind||'pellet');shot.hitIds.push(target.id);
          if(shot.burn>0)this._setBurn(target,4+shot.burn*4);
          if(shot.effect==='slow'&&shot.slowDuration>0)this._slowEnemy(target,shot.slowDuration,shot.slowStrength);
          if(shot.splashRadius>0)this._explodePlayerShot(shot,target.id);
          if (shot.comboBounced && !shot.comboResolved) {
            shot.comboResolved = true;
            this._tryFireRicochet(shot, target);
          }
          if(shot.pierce>0){shot.pierce--;shot.damage*=clamp(finite(shot.penetrationFalloff,1),.1,1);shot.x+=shot.vx*.001;shot.z+=shot.vz*.001;}else shot.life=0;
        }
      }else if(cover){
        if(shot.team==='player'&&shot.bounces>0){
          const dx=Math.min(Math.abs(shot.x-(cover.x-cover.w/2)),Math.abs(shot.x-(cover.x+cover.w/2)));
          const dz=Math.min(Math.abs(shot.z-(cover.z-cover.d/2)),Math.abs(shot.z-(cover.z+cover.d/2)));
          if(dx<dz)shot.vx*=-1;else shot.vz*=-1;
          shot.bounces--;shot.x+=shot.vx*.002;shot.z+=shot.vz*.002;this._event('ricochet',{x:shot.x,z:shot.z});
          if (s.upgrades['fire-ricochet'] > 0) shot.comboBounced = true;
        }else shot.life=0;
      }
      const b=this.bounds;
      if(shot.x<b.minX||shot.x>b.maxX||shot.z<b.minZ||shot.z>b.maxZ){
        if(shot.team==='player'&&shot.bounces>0){
          if(shot.x<b.minX||shot.x>b.maxX)shot.vx*=-1;
          if(shot.z<b.minZ||shot.z>b.maxZ)shot.vz*=-1;
          shot.x=clamp(shot.x,b.minX+.02,b.maxX-.02);shot.z=clamp(shot.z,b.minZ+.02,b.maxZ-.02);shot.bounces--;
          if (s.upgrades['fire-ricochet'] > 0) shot.comboBounced = true;
        }else shot.life=0;
      }
      if(shot.life<=0&&shot.splashRadius>0)this._explodePlayerShot(shot);
      if(s.phase==='dead'||s.phase==='won')break;
    }
    s.projectiles=s.projectiles.filter(shot=>shot.life>0);
  }

  _slowEnemy(enemy,duration,strength){
    if(enemy.hp<=0)return;
    enemy.slowTime=Math.max(enemy.slowTime||0,clamp(finite(duration),0,3));
    enemy.slowStrength=clamp(finite(strength),0,.45)*(enemy.type==='boss'?.35:1);
    this._event('frosthit',{id:enemy.id,x:enemy.x,z:enemy.z,duration:enemy.slowTime,strength:enemy.slowStrength});
  }

  _explodePlayerShot(shot,targetId=null){
    if(shot.exploded||shot.team!=='player')return;
    shot.exploded=true;
    for(const e of this.state.enemies){
      if(e.hp<=0||e.id===targetId||shot.hitIds.includes(e.id)||Math.hypot(e.x-shot.x,e.z-shot.z)>shot.splashRadius+e.radius*.3)continue;
      if(this.obstacles.some(b=>segmentBox(shot.x,shot.z,e.x,e.z,b)!==null))continue;
      this._damageEnemy(e,shot.damage*.55,'ember');
      if(shot.burn>0)this._setBurn(e,4+shot.burn*4);
    }
    this._event('emberblast',{x:shot.x,z:shot.z,radius:shot.splashRadius});
  }

  _setBurn(enemy, dps, duration=3, combo=false) {
    if (combo && enemy.burn > 0 && (enemy.burnDps > dps || (enemy.burnDps === dps && enemy.burn >= duration))) return false;
    enemy.burn = duration;
    enemy.burnDps = dps;
    enemy.burnCombo = combo;
    return true;
  }

  _readyCombinationRank(id) {
    const state = this.state;
    if (this._combination?.id !== id || state.phase !== 'playing' || state.elapsed + 1e-8 < state.comboReadyAt) return undefined;
    return combinationRank(id, state.upgrades[id]);
  }

  _activateCombination(id, combo, effect) {
    const state = this.state;
    state.comboReadyAt = state.elapsed + combo.cooldown;
    this._event('comboproc', {combo: id, rank: state.upgrades[id], ...effect});
  }

  _visibleComboTargets(origin, radius, excludedId) {
    const distance = enemy => Math.hypot(enemy.x - origin.x, enemy.z - origin.z);
    return this.state.enemies
      .filter(enemy => enemy.hp > 0 && enemy.id !== excludedId && distance(enemy) <= radius &&
        !this.obstacles.some(box => segmentBox(origin.x, origin.z, enemy.x, enemy.z, box) !== null))
      .sort((a, b) => distance(a) - distance(b));
  }

  _emitEchoWave(origin, combo) {
    const damage = Math.min(combo.damageCap, this.state.player.weapon.damage * combo.damageScale);
    this._activateCombination('echo-wave', combo, {x: origin.x, z: origin.z, radius: combo.radius});
    const targets = this._visibleComboTargets(origin, combo.radius, origin.id).slice(0, combo.targetLimit);
    for (const target of targets) {
      this._damageEnemy(target, damage * (target.type === 'boss' ? combo.bossScale : 1), 'combo');
      if (this.state.phase !== 'playing') break;
    }
  }

  _tryFireRicochet(shot, target) {
    const combo = this._readyCombinationRank('fire-ricochet');
    if (!combo || !(shot.burn > 0)) return;
    let ignited = 0;
    for (const enemy of this._visibleComboTargets(shot, combo.radius, target.id)) {
      const dps = combo.burnDps * (enemy.type === 'boss' ? combo.bossScale : 1);
      if (this._setBurn(enemy, dps, combo.duration, true) && ++ignited >= combo.targetLimit) break;
    }
    if (ignited) {
      const direction = normalize2(shot.vx, shot.vz);
      this._activateCombination('fire-ricochet', combo, {
        x: shot.x, z: shot.z, dx: direction.x, dz: direction.z, radius: combo.radius, duration: combo.duration,
      });
    }
  }

  _tryShrapnel(shot, target) {
    const volley = shot.comboVolley;
    if (volley.triggered) return;
    const hits = (volley.hits[target.id] ?? 0) + 1;
    volley.hits[target.id] = hits;
    const combo = this._readyCombinationRank('shrapnel-line');
    if (!combo || hits < combo.hitThreshold) return;

    const state = this.state;
    const active = state.projectiles.filter(projectile => projectile.team === 'player' && projectile.life > 0).length;
    if (active + combo.pellets > 100) return;
    const direction = normalize2(shot.vx, shot.vz);
    const offset = target.radius + .09;
    const x = target.x + direction.x * offset;
    const z = target.z + direction.z * offset;
    const bounds = this.bounds;
    if (x <= bounds.minX || x >= bounds.maxX || z <= bounds.minZ || z >= bounds.maxZ ||
      this.obstacles.some(box => segmentBox(shot.x, shot.z, x, z, box) !== null)) return;

    volley.triggered = true;
    const speed = 30;
    const damage = Math.min(combo.damageCap, state.player.weapon.damage * combo.damageScale);
    for (const pellet of pelletDirections(direction.x, direction.z, combo.pellets, combo.spread)) {
      state.projectiles.push({
        id: this._id(), team: 'player', x, z, vx: pellet.x * speed, vz: pellet.z * speed,
        life: combo.range / speed, radius: .07, damage, pierce: 0, bounces: 0, burn: 0,
        hitIds: [target.id], comboSource: 'shrapnel-line',
      });
    }
    this._activateCombination('shrapnel-line', combo, {
      x, z, dx: direction.x, dz: direction.z, range: combo.range, spread: combo.spread / 2,
    });
  }

  _warningHits(w,p){
    if(w.shape==='line')return segmentCircle(w.fromX,w.fromZ,w.x,w.z,p.x,p.z,(w.width||1)*.5+p.radius*.5)!==null;
    const d=Math.hypot(w.x-p.x,w.z-p.z),margin=p.radius*.5;
    if(w.shape==='ring')return d+margin>=(w.innerRadius||0)&&d-margin<=w.radius;
    return d<w.radius+margin;
  }

  _updateWarnings(dt){
    const s=this.state,p=s.player;
    for(const warning of s.warnings){
      const source=s.enemies.find(e=>e.id===warning.sourceId&&e.hp>0);
      if(!source){warning.remaining=0;continue;}
      if(warning.type==='zone'){
        warning.remaining-=dt;warning.tickRemaining-=dt;
        if(warning.remaining>0&&warning.tickRemaining<=0){
          warning.tickRemaining+=warning.zoneInterval||.8;
          if(this._warningHits(warning,p))this._hurtPlayer(warning.zoneDamage||7,warning.x,warning.z,'zone');
        }
        continue;
      }
      if(warning.type==='explode'){warning.x=source.x;warning.z=source.z;}
      warning.remaining-=dt;
      if(warning.remaining<=0){
        if(warning.bossAbility)this._event('bossability',{...warning,id:source.id,type:'bossability',ability:warning.bossAbility,stage:'fire'});
        if(warning.type==='charge'){source.charge={dx:warning.dx,dz:warning.dz,remaining:warning.travelDuration||.65,speed:warning.speed||10,damage:warning.damage,hit:false};source.castUntil=s.elapsed;source.angle=Math.atan2(warning.dx,warning.dz);this._event('charge',{id:source.id,x:source.x,z:source.z,dx:warning.dx,dz:warning.dz});continue;}
        this._event('slam',{x:warning.x,z:warning.z,radius:warning.radius,shape:warning.shape,innerRadius:warning.innerRadius,width:warning.width,bossAbility:warning.bossAbility,explosion:warning.type==='explode',hazard:warning.hazard,beam:warning.beam,fromX:warning.fromX,fromZ:warning.fromZ,fromY:warning.fromY});
        if(this._warningHits(warning,p)){
          const hurt=this._hurtPlayer(warning.damage,warning.x,warning.z,'slam');if(hurt&&warning.effect)this._applyDebuff(warning.effect,warning.sourceId);
        }
        if(warning.type==='explode'){source.hp=0;this._event('explosion',{x:warning.x,z:warning.z});}
        if(warning.zoneDuration>0){warning.type='zone';warning.active=true;warning.remaining=warning.duration=warning.zoneDuration;warning.tickRemaining=warning.zoneInterval||.8;}
      }
    }
    s.warnings=s.warnings.filter(w=>w.remaining>0);
  }

  _updateDrops(dt){
    const s=this.state,p=s.player;
    for(const drop of s.drops){
      if(drop.collected)continue;
      if(drop.type!=='xp'){
        drop.life=(drop.life??20)-dt;
        if(drop.life<=0)continue;
        if(Math.hypot(p.x-drop.x,p.z-drop.z)<=.7)this._collectDrop(drop);
        continue;
      }
      const dx=p.x-drop.x,dz=p.z-drop.z,d=Math.hypot(dx,dz);
      if(d<p.pickupRadius&&d>.001){const move=Math.min(d,dt*(6.5+(p.pickupRadius-d)*3));drop.x+=dx/d*move;drop.z+=dz/d*move;}
      if(Math.hypot(p.x-drop.x,p.z-drop.z)<.65)this._collectDrop(drop);
    }
    s.drops=s.drops.filter(d=>!d.collected&&(d.type==='xp'||d.life>0));
    this._checkLevel();
  }

  _collectDrop(drop){
    if(drop.collected)return;
    const s=this.state,p=s.player;drop.collected=true;s.stats.pickups++;
    this._event('pickup',{id:drop.id,x:drop.x,z:drop.z,value:drop.value||0,dropType:drop.type});
    if(drop.type==='xp'){s.xp+=drop.value*p.xpMultiplier;return;}
    s.stats.bonuses++;
    const duration={haste:10,rapid:8,shield:6}[drop.type]||0;
    let amount=0;
    if(drop.type==='heal'){amount=Math.min(25,p.maxHp-p.hp);p.hp+=amount;}
    else if(duration){
      p.buffs[drop.type]=Math.max(p.buffs[drop.type],duration);
      // A pending bow shot keeps its own cadence; the next arrow picks up
      // rapid fire through _shootArrow's independent interval and .4s floor.
      if(drop.type==='rapid'&&p.bowTime<=0)p.cooldown=Math.min(p.cooldown,p.weapon.fireInterval*.6);
      if(drop.type==='shield'){p.debuffs.slow=0;p.debuffs.poison=0;}
    }
    else if(drop.type==='magnet'){
      // Only experience is collected; other bonuses keep their risk/reward
      // position. Marking prevents a second pickup later in this same pass.
      for(const gem of s.drops)if(gem.type==='xp'&&!gem.collected){amount+=gem.value;this._collectDrop(gem);}
    }
    this._event('bonus',{bonus:drop.type,duration,amount,x:drop.x,z:drop.z});
  }

  _checkLevel(){
    const s=this.state;if(s.phase!=='playing'||s.xp<s.xpNeeded)return;
    s.xp-=s.xpNeeded;s.level++;s.xpNeeded=this.mode==='endless'?endlessXpNeeded(s.level):Math.round(9+(s.level-1)*5.5);
    s.player.hp=Math.min(s.player.maxHp,s.player.hp+6);
    const definitions = getUpgradeDefs(s.character, this.weaponId);
    const pool=definitions.filter(u=>s.upgrades[u.id]<u.max);
    const choices=[];
    const combo = this._combination;
    if (isCombinationUnlocked(combo, s.upgrades) && s.upgrades[combo.id] < combo.max) {
      choices.push({...combo, rank: s.upgrades[combo.id] + 1});
    }
    if(s.character==='pudge'&&!s.upgrades.rot&&s.level<=3){const index=pool.findIndex(u=>u.id==='rot');const[rot]=pool.splice(index,1);choices.push({...rot,rank:1});}
    while(pool.length&&choices.length<3){const index=Math.floor(this._random()*pool.length);const [upgrade]=pool.splice(index,1);choices.push({...upgrade,rank:s.upgrades[upgrade.id]+1});}
    // Once both branches have real investment, avoid stranding the recipe
    // behind random rolls. A normal ingredient roll already counts as help.
    if (combo && choices.length === 3 && s.level >= 8 && s.level % 2 === 0 &&
      combo.requirements.every(({id}) => s.upgrades[id] > 0) &&
      combo.requirements.reduce((total, {id}) => total + s.upgrades[id], 0) >= 4) {
      const missing = combo.requirements.filter(({id, rank}) => s.upgrades[id] < rank);
      if (missing.length && !choices.some(choice => missing.some(({id}) => id === choice.id))) {
        missing.sort((a, b) => s.upgrades[a.id] / a.rank - s.upgrades[b.id] / b.rank);
        const id = missing[0].id;
        choices[2] = {...definitions.find(definition => definition.id === id), rank: s.upgrades[id] + 1};
      }
    }
    if(!choices.length){s.player.hp=Math.min(s.player.maxHp,s.player.hp+30);return;}
    s.choices=choices;s.phase='upgrade';this._event('levelup',{level:s.level,choices:choices.map(u=>({...u}))});
  }

  chooseUpgrade(id){
    const s=this.state;if(s.phase!=='upgrade'||!s.choices.some(choice=>choice.id===id))return false;
    if (Object.hasOwn(UPGRADE_COMBINATIONS, id)) {
      const combo = this._combination;
      if (combo?.id !== id || !isCombinationUnlocked(combo, s.upgrades) || s.upgrades[id] >= combo.max) return false;
    }
    const p=s.player,w=p.weapon;s.upgrades[id]++;
    switch(id){
      case'damage':w.damage*=1.22;break;
      case'rate':w.fireInterval=Math.max(.18,w.fireInterval*.84);break;
      case'pellets':if(p.character!=='shelly'){w.range+=w.attackMode==='ranged'?.6:.22;w.arc+=Math.PI/15;w.bowRange+=.7;}else w.pellets+=2;break;
      case'pierce':w.pierce++;break;
      case'ricochet':w.ricochet++;break;
      case'burn':w.burn++;break;
      case'speed':p.speed*=1.09;break;
      case'maxhp':p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+30);break;
      case'regen':p.regen+=.65;break;
      case'pickup':p.pickupRadius+=1;p.xpMultiplier+=.08;break;
      case'rot':p.rot={level:s.upgrades.rot,radius:2.3+(s.upgrades.rot-1)*.2,dps:12+(s.upgrades.rot-1)*4,slow:.2};this._rotClock=0;break;
    }
    s.choices=[];s.phase='playing';this._event('upgrade',{id,rank:s.upgrades[id]});
    this._checkLevel();return true;
  }
}
