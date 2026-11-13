import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

// Disposable profile only. Normal buttons and keyboard operate the game.
// XP/death fixtures shorten lifecycle testing; visibility/blur fixtures invoke
// the public document/window handlers without touching any private director.
const origin=process.env.MUSIC_GAME_ORIGIN||'http://127.0.0.1:5190';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};
const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,locale:'ru-RU'});
await context.addInitScript(()=>{
 if(sessionStorage.getItem('music-qa-seeded'))return;
 localStorage.setItem('survival-character','steve');localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','on');
 localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:0,musicVolume:.37,sfxVolume:.24}));sessionStorage.setItem('music-qa-seeded','1');
});
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack});console.log('FAIL',name,error.message);}};
const tracks=()=>page.evaluate(()=>Object.fromEntries(['menu','battle'].map(id=>{const a=document.querySelector(`#${id}-music`);return[id,{src:a?.src,paused:a?.paused,volume:a?.volume,currentTime:a?.currentTime,loop:a?.loop,preload:a?.preload,readyState:a?.readyState,state:a?.dataset.menuMusicState}];})));
const phase=value=>page.waitForFunction(value=>window.__survivalTest?.run.state.phase===value,value);
async function ready(){await page.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__survivalTest?.lobby&&document.querySelector('#battle-music'),null,{timeout:60000});await page.waitForFunction(()=>!document.querySelector('#start').disabled);}
async function waitChannel(channel,volume=.47){
 await page.waitForFunction(({channel,volume})=>{
  const m=document.querySelector('#menu-music'),b=document.querySelector('#battle-music');
  if(!m||!b)return false;
  if(channel==='none')return m.paused&&b.paused&&m.volume===0&&b.volume===0;
  const active=channel==='menu'?m:b,other=channel==='menu'?b:m;
  return !active.paused&&other.paused&&Math.abs(active.volume-volume)<.005&&other.volume===0;
 },{channel,volume});
}
async function watchOverlap(){
 await page.evaluate(()=>{
  clearInterval(window.__musicWatchTimer);window.__musicOverlaps=[];window.__musicMediaEvents=[];
  const record=type=>{const m=document.querySelector('#menu-music'),b=document.querySelector('#battle-music');const snapshot={type,time:performance.now(),phase:window.__survivalTest?.run.state.phase,menu:{paused:m.paused,volume:m.volume},battle:{paused:b.paused,volume:b.volume}};if(!m.paused&&!b.paused)window.__musicOverlaps.push(snapshot);if(type!=='sample')window.__musicMediaEvents.push(snapshot);};
  for(const id of ['menu-music','battle-music'])for(const type of ['play','playing','pause'])document.getElementById(id).addEventListener(type,()=>record(id+':'+type));
  window.__musicWatchTimer=setInterval(()=>record('sample'),12);
 });
}
async function slider(value){
 const range=page.locator('#setting-music-volume');await range.press('Home');
 for(let i=0;i<Math.floor(value/10);i++)await range.press('PageUp');
 for(let i=0;i<value%10;i++)await range.press('ArrowRight');
 assert.equal(Number(await range.inputValue()),value);
}
async function freezeAndResume(kind,channel){
 const before=await tracks();
 if(kind==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 else await page.evaluate(()=>{window.__musicHiddenOwn=Object.getOwnPropertyDescriptor(document,'hidden');Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await waitChannel('none');const stopped=await tracks();await page.keyboard.press('x');await waitChannel('none');await page.waitForTimeout(160);
 const frozen=await tracks();for(const id of ['menu','battle'])assert.ok(Math.abs(frozen[id].currentTime-stopped[id].currentTime)<.025);
 if(kind==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 else await page.evaluate(()=>{if(window.__musicHiddenOwn)Object.defineProperty(document,'hidden',window.__musicHiddenOwn);else delete document.hidden;delete window.__musicHiddenOwn;document.dispatchEvent(new Event('visibilitychange'));});
 await waitChannel(channel);observations[`${kind}-${channel}`]={before,stopped,resumed:await tracks()};
}

try{
 await page.goto(`${origin}/survival.html`);await ready();await watchOverlap();
 await check('Both correct MP3 channels wait for a gesture and never preload battle playback in the lobby',async()=>{
  const t=await tracks();assert.match(new URL(t.menu.src).pathname,/\/game\/assets\/audio\/menu-theme\.mp3$/);assert.match(new URL(t.battle.src).pathname,/\/game\/assets\/audio\/battle-theme\.mp3$/);assert.notEqual(t.menu.src,t.battle.src);
  assert.equal(t.menu.loop,true);assert.equal(t.battle.loop,true);assert.equal(t.menu.paused,true);assert.equal(t.battle.paused,true);assert.equal(t.menu.preload,'none');assert.equal(t.battle.preload,'none');observations.initial=t;
 });
 await check('The first real settings gesture starts only the lobby track at the saved music volume',async()=>{
  await page.locator('#menu-settings').click();await waitChannel('menu',.37);assert.equal(Number(await page.locator('#setting-music-volume').inputValue()),37);observations.firstGesture=await tracks();
 });
 await check('A single real music slider changes the live channel and persists independently of SFX',async()=>{
  await slider(61);await waitChannel('menu',.61);const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('rift-survival-profile.v1')));assert.equal(p.musicVolume,.61);assert.equal(p.sfxVolume,.24);
 });
 await check('Global mute stops both tracks; changing the slider while muted cannot restart either',async()=>{
  await page.locator('[data-toggle="sound"]').click();await waitChannel('none');await slider(47);await waitChannel('none');assert.equal(await page.evaluate(()=>localStorage.getItem('shelly-range-sound')),'off');
  await page.locator('[data-toggle="sound"]').click();await waitChannel('menu');await page.locator('#panel-close').click();
 });
 await check('Reload preserves the common music volume and leaves both locked until a new gesture',async()=>{
  await page.reload();await ready();await watchOverlap();const t=await tracks();assert.equal(t.menu.paused,true);assert.equal(t.battle.paused,true);await page.locator('#menu-settings').click();assert.equal(Number(await page.locator('#setting-music-volume').inputValue()),47);await waitChannel('menu');await page.locator('#panel-close').click();
 });
 await check('Launch stops lobby before the battle track starts, using the same saved volume',async()=>{
  await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await phase('playing');await waitChannel('battle');
  await page.evaluate(()=>{const r=window.__survivalTest.run;r._spawnClock=99999;r.state.enemies=[];r.state.projectiles=[];r.state.warnings=[];r.state.drops=[];r.state.player.cooldown=9999;});observations.battle=await tracks();
 });
 await check('A real pause stops both tracks and resume continues only battle from its saved offset',async()=>{
  await page.locator('#pause').click();await phase('paused');await waitChannel('none');const a=await tracks();await page.waitForTimeout(180);const b=await tracks();assert.ok(Math.abs(a.battle.currentTime-b.battle.currentTime)<.025);
  await page.locator('#start').click();await phase('playing');await waitChannel('battle');assert.ok((await tracks()).battle.currentTime>=a.battle.currentTime);
 });
 await check('Global gameplay sound mute/unmute controls both music channels',async()=>{
  await page.locator('#sound').click();await waitChannel('none');assert.equal(await page.evaluate(()=>localStorage.getItem('shelly-range-sound')),'off');await page.locator('#sound').click();await waitChannel('battle');
 });
 await check('External blur pause blocks both tracks and user gestures until focus resumes the same phase',()=>freezeAndResume('blur','battle'));
 await check('Controlled hidden-document pause blocks both tracks and gestures, then resumes battle',()=>freezeAndResume('hidden','battle'));
 await check('The level-up choice keeps battle music continuous without starting lobby music',async()=>{
  const before=await tracks();await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;r.rng=()=>0;r.state.drops=[{id:998877,type:'xp',value:r.state.xpNeeded-r.state.xp,x:p.x,z:p.z}];});await phase('upgrade');await waitChannel('battle');assert.ok((await tracks()).battle.currentTime>=before.battle.currentTime);await page.locator('.upgrade-choice').first().click();await phase('playing');await waitChannel('battle');
 });
 await check('Result screen stops both; returning to the lobby starts only its own track',async()=>{
  await page.evaluate(()=>{const r=window.__survivalTest.run,p=r.state.player;p.invulnerable=0;r._hurtPlayer(999999,p.x,p.z,'music-qa');});await phase('dead');await waitChannel('none');observations.result=await tracks();await page.locator('#back-lobby').click();await phase('ready');await waitChannel('menu');
 });
 await check('External and hidden pauses also protect the resumed lobby track',async()=>{await freezeAndResume('blur','menu');await freezeAndResume('hidden','menu');});
 await check('No simultaneous playing channels or browser/media errors occurred through all transitions',async()=>{
  observations.media=await page.evaluate(()=>({overlaps:window.__musicOverlaps,events:window.__musicMediaEvents}));assert.deepEqual(observations.media.overlaps,[]);assert.deepEqual(errors,[]);
  const mediaErrors=await page.evaluate(()=>[...document.querySelectorAll('audio')].map(a=>({id:a.id,error:a.error?.code||0})));assert.ok(mediaErrors.every(a=>a.error===0));observations.media.errors=mediaErrors;
 });
}finally{
 await context.close();await browser.close();await writeFile('game/artifacts/music-switch-results.json',JSON.stringify({testedAt:new Date().toISOString(),origin,results,errors,observations,fixtureNotes:'Separate disposable local profile; normal shop/settings/game controls. XP/death fixtures shorten only lifecycle setup. Blur/focus dispatch public platform handlers; document.hidden is a controlled visibility fixture, restored after each check.'},null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
