import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {getUpgradeDefs} from '../survival-core.js';
import {upgradePresentation} from '../upgrade-presentation.js';

// Isolated browser storage only. XP drops and deterministic upgrade rolls are
// dev-only fixtures; rendering, launch, input, cards and selection remain real.
const origin=process.env.UPGRADE_GAME_ORIGIN||'http://127.0.0.1:5190';
const filter=process.env.UPGRADE_QA_FILTER?new RegExp(process.env.UPGRADE_QA_FILTER):null;
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};let context,page;
const phase=name=>page.waitForFunction(name=>window.__survivalTest.run.state.phase===name,name);
async function check(name,fn){if(filter&&!filter.test(name))return;try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){
 const debug=page?await page.evaluate(()=>({phase:window.__survivalTest?.run.state.phase,choices:window.__survivalTest?.run.state.choices,upgrades:window.__survivalTest?.run.state.upgrades,scrollTop:document.querySelector('.upgrade-sheet')?.scrollTop,input:window.__upgradeInputTrace,tap:window.__upgradeTapDebug})).catch(()=>null):null;
 if(page)await page.screenshot({path:`game/artifacts/upgrade-cards-failure-${name.split(':')[0].replaceAll(/[^a-zA-Z0-9-]/g,'-')}.png`}).catch(()=>{});
 results.push({name,ok:false,error:error.stack,debug});console.error('FAIL',name,error.message);
}finally{await context?.close();context=null;page=null;}}
async function fresh({character='steve',weapon='wooden-sword',viewport={width:1280,height:800}}={}){
 const touch=viewport.width<1000;
 context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1,locale:'ru-RU'});
 await context.addInitScript(({character,weapon})=>{
  localStorage.setItem('survival-character',character);localStorage.setItem('survival-map','cubic');localStorage.setItem('shelly-range-sound','off');
  localStorage.setItem('rift-survival-profile.v1',JSON.stringify({wallet:0,owned:['teal'],equipped:'teal',ownedWeapons:[...new Set(['wooden-sword',weapon])],weapon,ownedSkills:['bow'],skill:'bow',claims:[],runs:[]}));
 },{character,weapon});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${origin}/survival.html`);await page.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__survivalTest?.run,null,{timeout:60000});
 await page.evaluate(()=>{window.__upgradeInputTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click'])document.addEventListener(type,event=>{if(!event.target.closest?.('#upgrade-overlay'))return;window.__upgradeInputTrace.push({type,target:event.target.className,choice:event.target.closest('.upgrade-choice')?.dataset.upgrade,pointer:event.pointerType,time:performance.now(),scroll:document.querySelector('.upgrade-sheet')?.scrollTop});window.__upgradeInputTrace=window.__upgradeInputTrace.slice(-30);},true);});
 await page.locator('#start').click();await page.locator('[data-mode="endless"]').click();await page.locator('#launch-run').click();await phase('playing');
 assert.equal(await page.evaluate(()=>window.__survivalTest.run.state.character),character);
}
async function offer(ids){
 await page.evaluate(async ids=>{
  const {getUpgradeDefs}=await import('/game/survival-core.js');const r=window.__survivalTest.run,s=r.state,p=s.player;
  if(s.phase!=='playing')throw new Error(`Cannot arrange an XP pickup in phase ${s.phase}`);
  r._spawnClock=99999;r._nextBonusAt=99999;s.enemies=[];s.projectiles=[];s.warnings=[];p.invulnerable=99999;
  const pool=getUpgradeDefs(s.character,r.weaponId).filter(u=>s.upgrades[u.id]<u.max),remaining=[...ids];
  r.rng=()=>{const id=remaining.shift();if(!id)return .1;const index=pool.findIndex(u=>u.id===id);if(index<0)throw new Error(`Unavailable fixture upgrade ${id}`);const value=(index+.25)/pool.length;pool.splice(index,1);return value;};
  s.drops=[{id:987654,type:'xp',value:s.xpNeeded-s.xp,x:p.x,z:p.z}];
 },ids);
 await phase('upgrade');await page.locator('#upgrade-overlay').waitFor({state:'visible'});
 await page.waitForFunction(()=>[...document.querySelectorAll('.upgrade-choice img')].every(i=>i.complete&&i.naturalWidth>0));
 // Async image decoding can lag behind complete/naturalWidth. Inspect actual
 // painted cards, including landscape, rather than capturing a blank decode.
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.upgrade-choice img')].map(i=>i.decode()));await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 assert.deepEqual(await page.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>e.dataset.upgrade)),ids);
 return inspectCards();
}
async function inspectCards(){
 const state=await page.evaluate(()=>structuredClone(window.__survivalTest.run.state));
 const cards=await page.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>({id:e.dataset.upgrade,art:e.dataset.art,name:e.querySelector('.upgrade-name').textContent,bonuses:[...e.querySelectorAll('.upgrade-bonuses span')].map(e=>e.textContent),aria:e.getAttribute('aria-label'),text:e.textContent,stars:[...e.querySelectorAll('.upgrade-stars img')].map(i=>({state:i.className,src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0})),image:{src:e.querySelector('.upgrade-icon img').currentSrc,loaded:e.querySelector('.upgrade-icon img').complete&&e.querySelector('.upgrade-icon img').naturalWidth>0,width:e.querySelector('.upgrade-icon img').getBoundingClientRect().width,height:e.querySelector('.upgrade-icon img').getBoundingClientRect().height},width:e.clientWidth,scrollWidth:e.scrollWidth})));
 for(const card of cards){
  const definition=getUpgradeDefs(state.character,state.player.weapon.id).find(u=>u.id===card.id),presentation=upgradePresentation(state,card.id),current=state.upgrades[card.id];
  assert.equal(card.art,presentation.art);assert.equal(card.name,presentation.name);assert.deepEqual(card.bonuses,presentation.bonuses);
  assert.equal(card.stars.length,definition.max);assert.equal(card.stars.filter(s=>s.state==='earned').length,current);assert.equal(card.stars.filter(s=>s.state==='next').length,1);assert.equal(card.stars.filter(s=>s.state==='locked').length,definition.max-current-1);
  assert.ok(card.stars.every(s=>s.loaded&&s.src.includes('rank-star')));assert.ok(card.image.loaded&&card.image.src.includes(`${card.art}.webp`));
  assert.ok(card.image.width>=90&&card.image.height>=90,'illustration must have a meaningful visible size');
  assert.equal(card.aria,`${presentation.name}. ${presentation.bonuses.join('. ')}. Ранг ${current+1} из ${definition.max}`);
  assert.doesNotMatch(card.text,/Стив|Шелли|ближнее оружие|дальнее оружие/i);assert.ok(card.bonuses.length>=1&&card.bonuses.length<=3);
  assert.ok(card.scrollWidth<=card.width+1,`${card.id}: card content must not overflow horizontally`);
 }
 return cards;
}
async function select(index,{mouse=false,touch=false}={}){
 const before=await page.evaluate(()=>structuredClone(window.__survivalTest.run.state.upgrades)),ids=await page.locator('.upgrade-choice').evaluateAll(es=>es.map(e=>e.dataset.upgrade)),id=ids[index];
 let tap=null;
 if(mouse)await page.locator('.upgrade-choice').nth(index).dblclick();
 else if(touch){tap=await page.locator('.upgrade-choice').nth(index).evaluate(e=>{const r=e.getBoundingClientRect();window.__upgradeTapDebug={rect:JSON.parse(JSON.stringify(r)),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.upgrade-choice')?.dataset.upgrade};return window.__upgradeTapDebug;});assert.equal(tap.hit,id,'the card itself must receive the tap, without an overlay intercepting it');await page.locator('.upgrade-choice').nth(index).tap();}
 else{const key=String(index+1);await page.keyboard.down(key);await page.keyboard.down(key);await page.keyboard.up(key);}
 await phase('playing');await page.waitForTimeout(80);
 const after=await page.evaluate(()=>structuredClone(window.__survivalTest.run.state.upgrades));
 for(const key of Object.keys(before))assert.equal(after[key],before[key]+(key===id?1:0),`${id}: one physical choice must apply exactly one rank`);
 assert.equal(await page.locator('#upgrade-overlay').isVisible(),false);
 // A repeated key after the overlay closes must not spend another choice.
 await page.keyboard.press(String(index+1));assert.deepEqual(await page.evaluate(()=>structuredClone(window.__survivalTest.run.state.upgrades)),after);
 if(touch){tap.events=await page.evaluate(()=>window.__upgradeInputTrace);assert.equal(tap.events.filter(e=>e.type==='click'&&e.choice===id).length,1,'one touch tap must generate one card click');}
 return{id,before,after,tap};
}
async function touchScrollToThird(){
 const sheet=page.locator('#upgrade-overlay .upgrade-sheet'),before=await sheet.evaluate(e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight}));
 assert.ok(before.max>0,'portrait choice list must expose genuine vertical scrolling');
 const cdp=await context.newCDPSession(page),box=await sheet.boundingBox(),x=Math.round(box.x+box.width/2),start=Math.round(Math.min(box.y+box.height-25,page.viewportSize().height-25)),end=Math.round(box.y+55);
 for(let pass=0;pass<3;pass++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start,radiusX:4,radiusY:4}]});
  for(let step=1;step<=18;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*step/18,radiusX:4,radiusY:4}]});await page.waitForTimeout(25);}
  // End a deliberate drag with the finger stationary, rather than generating
  // an artificially fast fling whose first subsequent tap only stops it.
  await page.waitForTimeout(140);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:end,radiusX:4,radiusY:4}]});await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(160);
  const visible=await page.locator('.upgrade-choice').nth(2).evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.upgrade-sheet').getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom;});if(visible)break;
 }
 await cdp.detach();
 // A tap during native momentum scrolling intentionally stops the scroll and
 // may not activate the button. Wait for the actual scroll position to settle,
 // rather than treating that expected touch behavior as a failed selection.
 let previous=-1,stable=0;
 for(let n=0;n<60&&stable<4;n++){const current=await sheet.evaluate(e=>e.scrollTop);stable=Math.abs(current-previous)<.5?stable+1:0;previous=current;await page.waitForTimeout(50);}
 assert.ok(stable>=4,'native touch momentum must finish before selecting a card');
 const after=await sheet.evaluate(e=>e.scrollTop);assert.ok(after>before.top,'real touch swipe must scroll the upgrade sheet');
 const third=await page.locator('.upgrade-choice').nth(2).boundingBox();assert.ok(third.y>=0&&third.y+third.height<=page.viewportSize().height,'third choice must be visible before tapping');return{before,after};
}

try{
 await mkdir('game/artifacts',{recursive:true});
 for(const scenario of[{key:'steve-melee',character:'steve',weapon:'wooden-sword',damage:'damage-melee',area:'area-melee'},{key:'steve-ranged',character:'steve',weapon:'crossbow',damage:'damage-ranged',area:'area-ranged'},{key:'shelly',character:'shelly',weapon:'wooden-sword',damage:'damage-shell',area:'area-shell'}]){
  await check(`${scenario.key}: contextual cards, real 3/4/5-star limits, next rank and mouse/1/2/3 apply once`,async()=>{
   await fresh(scenario);const first=await offer(['damage','rate','pellets']);assert.deepEqual(first.map(c=>c.art),[scenario.damage,'rate',scenario.area]);assert.deepEqual(first.map(c=>c.stars.length),[5,5,4]);
   await page.screenshot({path:`game/artifacts/upgrade-cards-${scenario.key}-desktop.png`});const selections=[await select(0,{mouse:true})];
   const effects=await offer(['pierce','burn','ricochet']);assert.deepEqual(effects.map(c=>c.stars.length),[3,4,3]);assert.equal(effects[0].art,scenario.key==='steve-melee'?'knockback':'pierce');
   selections.push(await select(0));
   const next=await offer(['pierce','pellets','damage']);assert.equal(next[0].stars.filter(s=>s.state==='earned').length,1);assert.equal(next[2].stars.filter(s=>s.state==='earned').length,1);selections.push(await select(1));
   const utility=await offer(['speed','maxhp','regen']);assert.deepEqual(utility.map(c=>c.art),['speed','maxhp','regen']);selections.push(await select(2));
   const pickup=await offer(['pickup','pierce','damage']);assert.equal(pickup[0].art,'pickup');selections.push(await select(0));observations[scenario.key]={first,effects,next,utility,pickup,selections};
  });
 }
 for(const viewport of[{width:390,height:844},{width:320,height:740},{width:844,height:390}]){
  await check(`${viewport.width}x${viewport.height}: readable cards fit, touch reaches and selects choice 3`,async()=>{
   await fresh({character:'steve',weapon:'crossbow',viewport});const cards=await offer(['pellets','pierce','burn']);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),viewport.width);
   const geometry=await page.locator('#upgrade-overlay .upgrade-sheet').evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))}));assert.ok(geometry.scrollWidth<=geometry.width+1);assert.ok(geometry.rect.left>=0&&geometry.rect.right<=viewport.width);
   const scroll=viewport.width<600?await touchScrollToThird():null;
   await page.screenshot({path:`game/artifacts/upgrade-cards-${viewport.width}x${viewport.height}-choice3.png`});const selection=await select(2,{touch:true});observations[`${viewport.width}x${viewport.height}`]={cards,geometry,scroll,selection};
  });
 }
 await check('All 20 runtime WebP assets decode, and the decorative frame is actually applied',async()=>{
  await fresh();await offer(['damage','rate','pellets']);
  const assets=await page.evaluate(async()=>{const{upgradeImages}=await import('/game/upgrade-art.js');return Promise.all(Object.entries(upgradeImages).map(async([key,url])=>{const image=new Image();image.src=url;await image.decode();const response=await fetch(url);return{key,width:image.naturalWidth,height:image.naturalHeight,status:response.status,type:response.headers.get('content-type')};}));});
  assert.equal(assets.length,20);for(const asset of assets){assert.equal(asset.status,200);assert.match(asset.type,/image\/webp/);assert.deepEqual([asset.width,asset.height],asset.key==='card-frame'?[1254,1254]:asset.key==='rank-star'?[256,256]:[640,640]);}
  const frame=await page.locator('.upgrade-choice').first().evaluate(e=>getComputedStyle(e).borderImageSource);assert.match(frame,/card-frame\.webp/);observations.runtimeAssets=assets;
 });
 await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
}finally{
 await context?.close();await browser.close();await writeFile(`game/artifacts/upgrade-cards${filter?'-focused':''}-results.json`,JSON.stringify({testedAt:new Date().toISOString(),origin,filter:filter?.source||null,results,errors,observations},null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
