import assert from 'node:assert/strict';
import {copyFile,mkdir,mkdtemp,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {runReward,ACHIEVEMENT_REWARDS,AURA_PRICES} from '../economy.js';

// Uses a fresh browser/profile, never the player's open tab or save data.
// Fixtures shorten combat only; actual buttons and core end paths perform
// mode selection, launches, pause/resume, settlement, rewards and purchases.
const url=process.env.MENU_QA_URL||'http://127.0.0.1:5190/survival.html';
const output=fileURLToPath(new URL('../artifacts/',import.meta.url));
const temporary=await mkdtemp(join(tmpdir(),'survival-menu-qa-'));
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};
const recordKey='shelly-survival-record.v1',profileKey='rift-survival-profile.v1';
const seededRecord={kills:321,time:275,wins:7};
const viewports=[{width:1280,height:800},{width:390,height:844},{width:844,height:390},{width:320,height:740},{width:1376,height:768}];
const state=p=>p.evaluate(()=>window.__survivalTest.snapshot());
const profile=p=>p.evaluate(()=>structuredClone(window.__survivalTest.lobby.profile));
const phase=(p,value)=>p.waitForFunction(value=>document.querySelector('#hud').dataset.phase===value,value,{timeout:15000});

async function check(name,fn){
 try{await fn();results.push({name,ok:true});console.log('PASS',name);}
 catch(error){results.push({name,ok:false,error:error.stack||error.message});console.log('FAIL',name,error.message);}
}
async function fresh(viewport=viewports[0],{hero='steve',record=seededRecord}={}){
 const touch=viewport.width<900;
 const context=await browser.newContext({viewport,locale:'ru-RU',hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
 await context.addInitScript(({hero,record,recordKey,profileKey})=>{
  if(sessionStorage.getItem('menu-qa-initialized'))return;
  localStorage.setItem('survival-character',hero);localStorage.setItem('survival-map','cubic');
  if(record)localStorage.setItem(recordKey,JSON.stringify(record));else localStorage.removeItem(recordKey);
  localStorage.removeItem(profileKey);localStorage.setItem('shelly-range-sound','off');sessionStorage.setItem('menu-qa-initialized','true');
 },{hero,record,recordKey,profileKey});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url);await ready(page);return{context,page,touch};
}
async function ready(p){
 await p.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__survivalTest?.lobby,null,{timeout:60000});
 await phase(p,'ready');await p.locator('#start').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#start').disabled);
}
async function activate(p,selector,touch=false){if(touch)await p.locator(selector).tap();else await p.locator(selector).click();}
async function open(p,type,touch=false){
 if(await p.locator('#lobby-panel').isVisible())await close(p,touch);
 await activate(p,type==='play'?'#start':type==='help'?'#menu-help':type==='settings'?'#menu-settings':`.lobby-nav [data-panel="${type}"]`,touch);
 await p.waitForFunction(type=>{const d=document.querySelector('#lobby-panel');return d.open&&d.dataset.panel===type;},type);
}
async function close(p,touch=false){await activate(p,'#panel-close',touch);await p.waitForFunction(()=>!document.querySelector('#lobby-panel').open);}
async function selectHero(p,hero,touch=false){
 if(await p.locator('#lobby-panel').isVisible())await close(p,touch);
 await activate(p,'#change-hero',touch);await p.waitForFunction(()=>document.querySelector('#lobby-panel').open&&document.querySelector('#lobby-panel').dataset.panel==='inventory');
 const choice=p.locator(`button[data-select-hero="${hero}"]`);if(await choice.isEnabled())await activate(p,`button[data-select-hero="${hero}"]`,touch);await close(p,touch);
}
async function canvasCorner(p){return p.evaluate(()=>new Promise(resolve=>{
 const before=window.__survivalTest.renderInfo.frame;
 function sample(){if(window.__survivalTest.renderInfo.frame<=before){requestAnimationFrame(sample);return;}const canvas=document.querySelector('#world canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve({alphaContext:gl.getContextAttributes().alpha,rgba:[...pixel],lobby:document.body.dataset.lobbyScene,background:getComputedStyle(document.querySelector('#world')).backgroundImage});}
 requestAnimationFrame(sample);
}));}
async function pixelAssets(p){return p.evaluate(async()=>{
 const fonts=await Promise.all([document.fonts.load('900 22px Tektur','МАГАЗИН ИГРАТЬ Ё'),document.fonts.load('400 12px Tektur','Настройки ёж')]);
 const descriptors=[['.lobby-brand','backgroundImage'],['#start','borderImageSource'],['.lobby-nav-button','borderImageSource']];
 const bg=window.__survivalTest.menuStage.atmosphere.uniforms.uWorld.value.image;const images=[{selector:'animated world',url:bg.currentSrc,width:bg.naturalWidth,height:bg.naturalHeight}];
 for(const[selector,property]of descriptors){const value=getComputedStyle(document.querySelector(selector))[property],url=value.match(/url\(["']?(.*?)["']?\)/)?.[1];if(!url)throw new Error(`Missing ${selector} ${property}: ${value}`);const image=new Image();image.src=url;await image.decode();images.push({selector,url,width:image.naturalWidth,height:image.naturalHeight});}
 return{fonts:fonts.map(list=>list.map(f=>({family:f.family,weight:f.weight,status:f.status}))),images,family:getComputedStyle(document.querySelector('#start')).fontFamily,weight:getComputedStyle(document.querySelector('#start')).fontWeight};
});}
async function visibleBox(p,selector,{minHeight=0,hit=false}={}){
 assert.equal(await p.locator(selector).isVisible(),true,selector+' invisible');
 const details=await p.locator(selector).evaluate(e=>{
  const r=e.getBoundingClientRect(),center=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return{x:r.x,y:r.y,width:r.width,height:r.height,hit:e===center||e.contains(center),vw:innerWidth,vh:innerHeight};
 });
 assert.ok(details.width>0&&details.height>=minHeight,selector+' too small '+JSON.stringify(details));
 assert.ok(details.x>=-1&&details.y>=-1&&details.x+details.width<=details.vw+1&&details.y+details.height<=details.vh+1,selector+' outside viewport '+JSON.stringify(details));
 if(hit)assert.ok(details.hit,selector+' covered '+JSON.stringify(details));
 return details;
}
async function noOverflow(p){
 const sizes=await p.evaluate(()=>{const d=document.querySelector('#lobby-panel'),m=document.querySelector('#menu');return{vw:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,menu:m.scrollWidth,menuWidth:m.clientWidth,dialog:d.open?d.scrollWidth:0,dialogWidth:d.open?d.clientWidth:0};});
 assert.ok(sizes.document<=sizes.vw+1&&sizes.body<=sizes.vw+1&&sizes.menu<=sizes.menuWidth+1&&sizes.dialog<=sizes.dialogWidth+1,JSON.stringify(sizes));
}
async function panelControl(p,selector,{minHeight=0}={}){
 const before=await visibleBox(p,'#panel-close',{hit:true});
 await p.locator(selector).scrollIntoViewIfNeeded();
 const box=await visibleBox(p,selector,{minHeight,hit:true});
 assert.equal(await p.locator(selector).isEnabled(),true,selector+' disabled');
 const bounds=await p.locator('#panel-content').evaluate(e=>{
  const r=e.getBoundingClientRect(),h=document.querySelector('.panel-top').getBoundingClientRect();
  return{left:r.left+e.clientLeft,top:r.top+e.clientTop,right:r.left+e.clientLeft+e.clientWidth,bottom:r.top+e.clientTop+e.clientHeight,headerBottom:h.bottom,outerTop:document.querySelector('#lobby-panel').scrollTop};
 });
 assert.ok(box.x>=bounds.left-1&&box.y>=bounds.top-1&&box.x+box.width<=bounds.right+1&&box.y+box.height<=bounds.bottom+1,selector+' outside scrollable content '+JSON.stringify({box,bounds}));
 assert.ok(box.y>=bounds.headerBottom-1,selector+' overlaps dialog header '+JSON.stringify({box,bounds}));
 assert.equal(bounds.outerTop,0,'outer dialog moved instead of its content');
 const after=await visibleBox(p,'#panel-close',{hit:true});
 assert.ok(Math.abs(after.x-before.x)<=1&&Math.abs(after.y-before.y)<=1,'close button moved while revealing '+selector);
 return box;
}
async function nativeDialogScroll(p){
 const content=p.locator('#panel-content');
 await content.evaluate(e=>e.scrollTop=0);await p.waitForTimeout(150);
 const closeBefore=await visibleBox(p,'#panel-close',{hit:true});
 const scroll=await content.evaluate(e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight}));
 if(scroll.max<10)return{needed:false};
 const b=await visibleBox(p,'#panel-content'),session=await p.context().newCDPSession(p),x=b.x+b.width*.55,start=b.y+b.height*.78,end=b.y+b.height*.3;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]});
 for(let i=1;i<=10;i++){const eased=1-(1-i/10)**3;await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*eased}]});await p.waitForTimeout(20);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(450);await session.detach();
 const after=await content.evaluate(e=>e.scrollTop);
 assert.ok(after>scroll.top+10,`native touch scroll blocked: ${JSON.stringify({before:scroll,after})}`);
 assert.equal(await p.locator('#lobby-panel').evaluate(e=>e.scrollTop),0,'native gesture scrolled the outer dialog');
 const closeAfter=await visibleBox(p,'#panel-close',{hit:true});
 assert.ok(Math.abs(closeAfter.x-closeBefore.x)<=1&&Math.abs(closeAfter.y-closeBefore.y)<=1,'close button moved during native content scroll');
 await content.evaluate(e=>e.scrollTop=0);await p.waitForTimeout(150);return{needed:true,max:scroll.max,after};
}
async function screenshot(p,name){await p.screenshot({path:join(temporary,name)});}
async function safePlaying(p){await p.evaluate(()=>{const r=window.__survivalTest.run;r._spawnClock=99999;r.state.enemies=[];r.state.projectiles=[];r.state.drops=[];r.state.warnings=[];r.state.player.invulnerable=99999;});}
async function launch(p,mode='campaign',touch=false){await open(p,'play',touch);await activate(p,`button[data-mode="${mode}"]`,touch);await activate(p,'#launch-run',touch);await phase(p,'playing');await safePlaying(p);}
async function backToLobby(p,touch=false){await activate(p,'#back-lobby',touch);await phase(p,'ready');}

let current;
try{
 for(const viewport of process.env.MENU_QA_SKIP_LAYOUT?[]:viewports){
  const label=`${viewport.width}×${viewport.height}`,suffix=viewport.width===1280?'desktop':viewport.width===844?'landscape':viewport.width===1376?'reference':String(viewport.width);
  current=await fresh(viewport);const{page:p,touch}=current;observations[label]={};
  if(viewport.width===1280)await check('Lobby idle render is capped, modal rendering freezes and closing resumes it',async()=>{
   await p.waitForTimeout(150);const a=await p.evaluate(()=>({info:window.__survivalTest.renderInfo,time:performance.now()}));await p.waitForTimeout(650);const b=await p.evaluate(()=>({info:window.__survivalTest.renderInfo,time:performance.now()}));
   const seconds=(b.time-a.time)/1000,frames=b.info.frame-a.info.frame;assert.ok(frames>=2&&frames<=seconds*35+2,JSON.stringify({frames,seconds,a,b}));
   await open(p,'help');await p.waitForTimeout(120);const frozen=await p.evaluate(()=>window.__survivalTest.renderInfo.frame);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>window.__survivalTest.renderInfo.frame),frozen,'3D keeps rendering behind the dialog');
   await close(p);await p.waitForFunction(frame=>window.__survivalTest.renderInfo.frame>frame,frozen);observations.performance={frames,seconds,fps:frames/seconds,render:b.info};
  });
  await check(`${label}: five visible navigation targets with central larger PLAY and no overflow`,async()=>{
   const expected=['shop','inventory','start','leaderboard','achievements'];
   const selectors=expected.map(id=>id==='start'?'#start':`.lobby-nav [data-panel="${id}"]`);
   assert.equal(await p.locator('.lobby-nav button').count(),5);const boxes=[];
   for(const selector of selectors)boxes.push(await visibleBox(p,selector,{minHeight:44,hit:true}));
   const play=boxes[2];assert.ok(Math.abs(play.x+play.width/2-viewport.width/2)<2,'PLAY is not centered');
   for(const i of [0,1,3,4])assert.ok(play.width>boxes[i].width*1.2&&play.height>boxes[i].height,'PLAY should have visual priority');
   const change=await visibleBox(p,'#change-hero',{minHeight:32,hit:true});assert.ok(change.y+change.height<play.y,'hero switch overlaps PLAY');assert.equal(await p.locator('#character-picker').isVisible(),false);
   const labels=await p.locator('.lobby-nav-button').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect(),t=e.querySelector('b').getBoundingClientRect();return{text:e.innerText,button:{x:b.x,width:b.width},textBox:{x:t.x,width:t.width}};}));
   for(const l of labels)assert.ok(l.textBox.x>=l.button.x-1&&l.textBox.x+l.textBox.width<=l.button.x+l.button.width+1,'nav text overflows frame '+JSON.stringify(l));
   await noOverflow(p);observations[label]={nav:boxes,change,labels};
   await screenshot(p,`pixel-menu-${suffix}.png`);
  });
  await check(`${label}: pixel assets and Cyrillic font load, live 3D hero rotates over the single animated background`,async()=>{
   for(const selector of ['#hud','#touch-controls','#super','.xp-row','.desktop-guide'])assert.equal(await p.locator(selector).isVisible(),false,selector+' leaked into lobby');
   assert.equal(await p.locator('button[data-character="pudge"]').isVisible(),false);
   assert.equal(await p.locator('#world canvas').count(),1);
   const model=await p.evaluate(()=>{const t=window.__survivalTest;return{stage:t.menuStage.root.visible,steve:t.steve.root.visible,shelly:t.model.visible,children:t.menuStage.root.children.length,yaw:t.actor.rotation.y};});
   assert.ok(model.stage&&model.steve&&!model.shelly&&model.children>0);
   const assets=await pixelAssets(p);assert.match(assets.family,/Tektur/);assert.equal(assets.weight,'900');assert.ok(assets.fonts.every(list=>list.length>0&&list.every(f=>f.status==='loaded'&&f.family==='Tektur')));assert.ok(assets.images.every(i=>i.width>0&&i.height>0));
   const corner=await canvasCorner(p);assert.equal(corner.alphaContext,true);assert.equal(corner.rgba[3],255,'the animated world did not fill the lobby canvas');assert.equal(await p.locator('#lobby-vortex').count(),0);assert.equal(corner.lobby,'true');observations[label].assets=assets;observations[label].lobbyCorner=corner;
   const b=await visibleBox(p,'.lobby-showcase',{hit:true});
   await p.mouse.move(b.x+b.width*.35,b.y+b.height*.5);await p.mouse.down();await p.mouse.move(b.x+b.width*.65,b.y+b.height*.5,{steps:8});await p.mouse.up();
   await p.waitForFunction(before=>Math.abs(window.__survivalTest.actor.rotation.y-before)>.2,model.yaw);
  });
  await check(`${label}: hero choices, inventory and help show matching weapon and ability`,async()=>{
   for(const[hero,name,weapon,ability]of [['shelly','ШЕЛЛИ',/дробовик/i,/супер/i],['steve','СТИВ',/меч/i,/лук/i]]){
    await selectHero(p,hero,touch);assert.equal((await state(p)).character,hero);
    assert.equal(await p.locator('#lobby-hero-name').textContent(),name);assert.match(await p.locator('#hero-weapon').textContent(),weapon);assert.match(await p.locator('#super').getAttribute('aria-label'),ability);
    await open(p,'help',touch);assert.match(await p.locator('#ability-guide-title').innerText(),weapon);assert.match(await p.locator('#ability-guide-title').innerText(),ability);await close(p,touch);
   }
   await open(p,'inventory',touch);assert.equal(await p.locator('[data-select-hero]').count(),2);assert.match(await p.locator('.inventory-items').innerText(),/Деревянный меч/);
   await activate(p,'[data-select-hero="shelly"]',touch);assert.equal((await state(p)).character,'shelly');assert.match(await p.locator('.inventory-items').innerText(),/Дробовик/);assert.match(await p.locator('.inventory-items').innerText(),/Супервыстрел/);
   await noOverflow(p);if(touch)observations[label].nativeScroll=await nativeDialogScroll(p);await screenshot(p,`pixel-menu-inventory-${suffix}.png`);await close(p,touch);
   await selectHero(p,'steve',touch);
  });
  await check(`${label}: PLAY modal fits two real modes, map choices and launch CTA`,async()=>{
   await open(p,'play',touch);
   await visibleBox(p,'#lobby-panel');await visibleBox(p,'#panel-close',{hit:true});
   for(const selector of ['button[data-mode="campaign"]','button[data-mode="endless"]','button[data-map="cubic"]','button[data-map="frontier"]','#launch-run'])await panelControl(p,selector,{minHeight:selector==='#launch-run'?44:0});
   if(touch)observations[label].playNativeScroll=await nativeDialogScroll(p);
   await panelControl(p,'button[data-mode="endless"]');await activate(p,'button[data-mode="endless"]',touch);assert.equal(await p.locator('button[data-mode="endless"]').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#launch-run').innerText(),/соло/i);
   await panelControl(p,'button[data-map="frontier"]');await activate(p,'button[data-map="frontier"]',touch);assert.equal((await state(p)).map,'frontier');assert.equal(await p.locator('button[data-map="frontier"]').getAttribute('aria-pressed'),'true');
   await p.locator('.map-illustration img').evaluateAll(images=>Promise.all(images.map(async image=>{await image.decode();if(!image.naturalWidth)throw new Error('Map image did not load');})));
   await panelControl(p,'#launch-run',{minHeight:44});await noOverflow(p);await screenshot(p,`pixel-menu-mode-${suffix}.png`);await close(p,touch);
   await p.reload();await ready(p);assert.equal((await state(p)).map,'frontier');assert.equal((await state(p)).character,'steve');
   await open(p,'play',touch);assert.equal(await p.locator('button[data-map="frontier"]').getAttribute('aria-pressed'),'true');
   await activate(p,'button[data-map="cubic"]',touch);assert.equal((await state(p)).map,'cubic');await close(p,touch);
  });
  await check(`${label}: saved record is real, leaderboard is honestly empty, all sections open`,async()=>{
   assert.equal(await p.locator('#lobby-best-kills').innerText(),'321');assert.match(await p.locator('#best-record').textContent(),/04:35/);assert.match(await p.locator('#best-record').textContent(),/7/);
   assert.deepEqual(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),recordKey),seededRecord);assert.equal((await profile(p)).wallet,0);
   await open(p,'leaderboard',touch);assert.match(await p.locator('.local-badge').innerText(),/на этом устройстве/i);assert.equal(await p.locator('.leaderboard-table tbody tr').count(),0);assert.match(await p.locator('.panel-empty').innerText(),/заверши забег/i);await close(p,touch);
   for(const section of ['shop','achievements','settings']){await open(p,section,touch);await noOverflow(p);await visibleBox(p,'#panel-close',{hit:true});await screenshot(p,`pixel-menu-${section}-${suffix}.png`);await close(p,touch);}
  });
  await check(`${label}: campaign start, pause, resume, restart and death preserve correct lifecycle`,async()=>{
   await launch(p,'campaign',touch);assert.equal((await state(p)).mode,'campaign');assert.equal(await p.locator('#menu').isVisible(),false);assert.equal(await p.locator('#hud').isVisible(),true);
   const corner=await canvasCorner(p);assert.equal(corner.lobby,'false');assert.equal(corner.rgba[3],255,'game did not restore its opaque arena background');observations[label].gameCorner=corner;
   await p.waitForFunction(()=>window.__survivalTest.run.state.elapsed>.25);await activate(p,'#pause',touch);await phase(p,'paused');const before=await state(p);
   for(const selector of ['#start','#restart','#back-lobby'])await visibleBox(p,selector,{minHeight:selector==='#start'?40:0,hit:true});
   assert.match(await p.locator('#start').innerText(),/продолжить/i);assert.equal(await p.locator('.lobby-nav').isVisible(),false);
   await p.waitForTimeout(120);const frozen=await p.evaluate(()=>window.__survivalTest.renderInfo.frame);await p.waitForTimeout(220);assert.equal((await state(p)).elapsed,before.elapsed);assert.equal(await p.evaluate(()=>window.__survivalTest.renderInfo.frame),frozen,'3D keeps rendering while paused');await screenshot(p,`pixel-menu-pause-${suffix}.png`);
   await activate(p,'#start',touch);await phase(p,'playing');assert.equal((await state(p)).character,before.character);assert.equal((await state(p)).map,before.map);assert.ok((await state(p)).elapsed>=before.elapsed);
   await activate(p,'#pause',touch);await phase(p,'paused');await activate(p,'#restart',touch);await phase(p,'playing');assert.ok((await state(p)).elapsed<.8);assert.equal((await state(p)).level,1);await safePlaying(p);
   await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.player.invulnerable=0;r._hurtPlayer(99999,r.state.player.x,r.state.player.z,'menu-qa');});await phase(p,'dead');
   assert.equal(await p.locator('#result-stats').isVisible(),true);for(const selector of ['#start','#back-lobby','#result-stats'])await visibleBox(p,selector,{minHeight:selector==='#start'?40:0,hit:selector!=='#result-stats'});await noOverflow(p);
   await screenshot(p,`pixel-menu-result-${suffix}.png`);await backToLobby(p,touch);assert.equal(await p.locator('.lobby-nav').isVisible(),true);assert.equal(await p.locator('#nav-play-slot #start').count(),1);
  });
  await current.context.close();current=null;
 }
 current=await fresh(viewports[0],{record:null});
 await check('Endless chosen through UI counts upward, survives boss defeat and credits retirement once',async()=>{
  const p=current.page;await launch(p,'endless');assert.equal((await state(p)).mode,'endless');assert.equal((await state(p)).nextBossAt,180);assert.match(await p.locator('#wave-label').innerText(),/соло/i);
  await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.elapsed=179.99;});
  await p.waitForFunction(()=>document.querySelector('#hud').dataset.boss==='true');assert.match(await p.locator('#clock-caption').innerText(),/босс на арене/i);
  await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state;r._damageEnemy(s.enemies.find(e=>e.id===s.bossId),99999,'menu-qa');s.kills=63;s.elapsed=195.25;s.drops=[];});
  await p.waitForFunction(()=>window.__survivalTest.run.state.stats.bosses===1&&window.__survivalTest.run.state.bossId===null);assert.equal((await state(p)).phase,'playing');
  await activate(p,'#pause');await phase(p,'paused');await activate(p,'#back-lobby');await phase(p,'retired');
  const earned=await profile(p),expected=runReward({kills:63,elapsed:earned.runs[0].time,bosses:1}).total;assert.equal(earned.wallet,expected);assert.equal(earned.runs.length,1);assert.equal(earned.runs[0].kills,63);assert.equal(earned.runs[0].mode,'endless');assert.equal(earned.runs[0].bosses,1);assert.equal(earned.runs[0].won,false);assert.ok((await p.locator('#result-reward').innerText()).includes(String(expected)));
  await p.waitForTimeout(250);assert.deepEqual(await profile(p),earned);await backToLobby(p);assert.deepEqual(await profile(p),earned);
  await open(p,'leaderboard');const rows=p.locator('.leaderboard-table tbody tr');assert.equal(await rows.count(),1);const text=await rows.first().innerText();assert.match(text,/Стив.*Соло/);assert.match(text,/63/);const seconds=Math.floor(earned.runs[0].time),savedTime=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;assert.ok(text.includes(savedTime),text+' expected '+savedTime);await close(p);
  observations.retirement=earned;
 });
 await check('Achievement claim, cosmetic purchase and equipment persist without duplicate charges or negative funds',async()=>{
  const p=current.page,beforeClaim=(await profile(p)).wallet,claimedWallet=beforeClaim+ACHIEVEMENT_REWARDS.first;await open(p,'achievements');assert.equal(await p.locator('[data-claim="first"]').isEnabled(),true);await activate(p,'[data-claim="first"]');assert.equal((await profile(p)).wallet,claimedWallet);assert.equal(await p.locator('[data-claim="first"]').isEnabled(),false);
  await p.evaluate(()=>window.__survivalTest.lobby.claim('first'));assert.equal((await profile(p)).wallet,claimedWallet);assert.equal((await profile(p)).claims.filter(id=>id==='first').length,1);await close(p);
  await open(p,'shop');await activate(p,'[data-shop-tab="auras"]');assert.equal(await p.locator('[data-shop-tab="auras"]').getAttribute('aria-selected'),'true');assert.ok(claimedWallet<AURA_PRICES.amber);await activate(p,'[data-buy="amber"]');assert.equal((await profile(p)).wallet,claimedWallet);assert.ok(!(await profile(p)).owned.includes('amber'));assert.match(await p.locator('.panel-toast').innerText(),/нужно ещё/i);
  // Functional purchase fixture after proving the real first payout cannot
  // afford a premium cosmetic. This is not a new-player starting balance.
  await p.evaluate(budget=>{const l=window.__survivalTest.lobby;l.profile.wallet=budget;l.persist();l.render();},AURA_PRICES.amber+1);
  await activate(p,'[data-buy="amber"]');let save=await profile(p);assert.equal(save.wallet,1);assert.equal(save.equipped,'amber');assert.equal(save.owned.filter(id=>id==='amber').length,1);
  await activate(p,'[data-buy="teal"]');await activate(p,'[data-buy="amber"]');assert.equal((await profile(p)).wallet,1);
  await activate(p,'[data-buy="violet"]');save=await profile(p);assert.equal(save.wallet,1);assert.equal(save.equipped,'amber');assert.ok(!save.owned.includes('violet'));assert.match(await p.locator('.panel-toast').innerText(),/нужно ещё/i);
  await close(p);await p.reload();await ready(p);save=await profile(p);assert.equal(save.wallet,1);assert.equal(save.equipped,'amber');assert.deepEqual([...save.owned].sort(),['amber','teal']);assert.equal(save.claims.filter(id=>id==='first').length,1);assert.equal(save.runs.length,1);
  assert.deepEqual(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),profileKey),save);
  assert.equal(await p.evaluate(()=>window.__survivalTest.actor.children.find(o=>o.geometry?.type==='RingGeometry').material.color.getHexString()),'ffd078');
  await open(p,'inventory');assert.equal(await p.locator('[data-buy="amber"]').isEnabled(),false);await screenshot(p,'pixel-menu-purchased-inventory.png');await close(p);
 });
 await check('Campaign boss victory saves one win and replay preserves selected hero',async()=>{
  const p=current.page;await selectHero(p,'shelly');await launch(p,'campaign');
  await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state;s.elapsed=246.25;s.kills=89;r._spawnBoss();r._damageEnemy(s.enemies.find(e=>e.id===s.bossId),99999,'menu-qa');});await phase(p,'won');
  await visibleBox(p,'#menu-title');assert.match(await p.locator('#menu-title').innerText(),/победа/i);assert.match(await p.locator('#result-stats').innerText(),/90/);assert.equal((await profile(p)).runs.length,2);
  const record=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),recordKey);assert.equal(record.wins,1);assert.equal(record.kills,90);
  await p.waitForTimeout(200);assert.equal(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).wins,recordKey),1);
  await activate(p,'#start');await phase(p,'playing');assert.equal((await state(p)).character,'shelly');assert.equal((await state(p)).player.hp,100);assert.equal((await state(p)).mode,'campaign');assert.match(await p.locator('#super').getAttribute('aria-label'),/Шелли/i);
 });
 await current.context.close();current=null;
 current=await fresh(viewports[1],{hero:'pudge',record:null});
 await check('Saved unfinished hero falls back safely and a new profile has an honest empty state',async()=>{
  const p=current.page;assert.ok(['steve','shelly'].includes((await state(p)).character));assert.equal(await p.locator('button[data-character="pudge"]').isVisible(),false);assert.equal((await profile(p)).wallet,0);assert.deepEqual((await profile(p)).runs,[]);assert.equal(await p.locator('#lobby-best-kills').innerText(),'0');
  assert.match(await p.locator('#best-record').textContent(),/первый рекорд/i);assert.equal(await p.evaluate(key=>localStorage.getItem(key),recordKey),null);
 });
 await check('Menu sound control toggles and persists the actual sound preference',async()=>{
  const p=current.page;assert.equal(await p.locator('#menu-sound').getAttribute('aria-pressed'),'false');await activate(p,'#menu-sound',true);assert.equal(await p.locator('#menu-sound').getAttribute('aria-pressed'),'true');assert.equal(await p.evaluate(()=>localStorage.getItem('shelly-range-sound')),'on');
  await activate(p,'#menu-sound',true);await p.reload();await ready(p);assert.equal(await p.locator('#menu-sound').getAttribute('aria-pressed'),'false');assert.equal(await p.locator('#sound').getAttribute('aria-pressed'),'false');
 });
 await check('Settings sound and menu-effects switches change actual state and survive reload',async()=>{
  const p=current.page;await open(p,'settings',true);assert.equal(await p.locator('[data-toggle="sound"]').getAttribute('aria-pressed'),'false');await activate(p,'[data-toggle="sound"]',true);assert.equal(await p.locator('#menu-sound').getAttribute('aria-pressed'),'true');assert.equal(await p.evaluate(()=>localStorage.getItem('shelly-range-sound')),'on');
  assert.equal(await p.locator('[data-toggle="effects"]').getAttribute('aria-pressed'),'true');await activate(p,'[data-toggle="effects"]',true);assert.equal((await profile(p)).effects,false);assert.equal(await p.locator('[data-toggle="effects"]').getAttribute('aria-pressed'),'false');assert.equal(await p.evaluate(()=>document.body.dataset.menuMotion),'false');await close(p,true);await p.waitForFunction(()=>!window.__survivalTest.menuStage.atmosphere.enabled);
  await p.reload();await ready(p);await open(p,'settings',true);assert.equal(await p.locator('[data-toggle="sound"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-toggle="effects"]').getAttribute('aria-pressed'),'false');await activate(p,'[data-toggle="sound"]',true);await activate(p,'[data-toggle="effects"]',true);assert.equal((await profile(p)).effects,true);await close(p,true);await p.waitForFunction(()=>window.__survivalTest.menuStage.atmosphere.enabled);
 });
 await check('No unhandled browser errors',()=>assert.deepEqual(errors,[]));
}finally{
 await current?.context.close();await browser.close();await writeFile(join(temporary,'pixel-menu-qa-results.json'),JSON.stringify({testedAt:new Date().toISOString(),url,results,errors,observations},null,2));
 await mkdir(output,{recursive:true});for(const name of await readdir(temporary))await copyFile(join(temporary,name),join(output,name));
}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
