import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Uses disposable browser profiles. Fixtures arrange real arena objects, then
// the normal renderer, input, collision, enemy attacks and HUD do the work.
const output=fileURLToPath(new URL('../artifacts/',import.meta.url));
const url=process.env.BOOST_QA_URL||'http://127.0.0.1:5190/survival.html';
const types=['heal','haste','rapid','shield','magnet'];
const expected={heal:['ЛЕЧЕНИЕ','+25 здоровья'],haste:['УСКОРЕНИЕ','+35% скорости · 10 с'],rapid:['БЫСТРАЯ АТАКА','Темп атаки ×1,67 · 8 с'],shield:['НЕУЯЗВИМОСТЬ','Без урона · 6 с'],magnet:['МАГНИТ ОПЫТА','Собирает весь опыт']};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[],observations={};let current;
const snapshot=p=>p.evaluate(()=>window.__survivalTest.snapshot());
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL',name,error.message);}}
async function fresh(viewport,touch=false){
 const context=await browser.newContext({viewport,locale:'ru-RU',deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
 await context.addInitScript(()=>{localStorage.setItem('survival-character','shelly');localStorage.setItem('survival-map','cubic');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 await page.locator('#start')[touch?'tap':'click']();await page.locator('[data-mode="endless"]')[touch?'tap':'click']();await page.locator('#launch-run')[touch?'tap':'click']();
 await page.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='playing');
 assert.equal((await snapshot(page)).map,'cubic');assert.equal((await snapshot(page)).mode,'endless');return{context,page};
}
async function arrange(p,{type=null,all=false,keepBuffs=false}={}){
 return p.evaluate(({type,all,keepBuffs})=>{
  const r=window.__survivalTest.run,s=r.state,p=s.player;r._spawnClock=999;r.obstacles=[];s.enemies=[];s.projectiles=[];s.warnings=[];s.drops=[];
  p.x=p.z=0;p.cooldown=999;p.invulnerable=0;p.pendingAttack=null;
  if(!keepBuffs){p.buffs={haste:0,rapid:0,shield:0};p.debuffs={slow:0,poison:0};p.hp=50;}
  const list=['heal','haste','rapid','shield','magnet'],xs=innerWidth<700&&innerHeight>540?[-2.4,-1.2,0,1.2,2.4]:[-3.4,-1.7,0,1.7,3.4],zs=[-1.2,-2,-2.5,-2,-1.2];
  if(all)for(const [i,type]of list.entries())s.drops.push({id:91000+i,type,x:xs[i],z:zs[i],life:20,value:0,radius:.3});
  else if(type)s.drops.push({id:92000+list.indexOf(type),type,x:2,z:0,life:20,value:0,radius:.3});
  if(type==='magnet')s.drops.push({id:93000,type:'xp',x:-9,z:-8,value:2,radius:.16},{id:93001,type:'xp',x:9,z:8,value:3,radius:.16});
  return{bonuses:s.stats.bonuses,xp:s.xp,hp:p.hp};
 },{type,all,keepBuffs});
}
async function walkToCollect(p,baseline){
 await p.keyboard.down('d');
 try{await p.waitForFunction(n=>window.__survivalTest.run.state.stats.bonuses===n+1,baseline,{timeout:4000});}
 finally{await p.keyboard.up('d');}
 await p.waitForFunction(n=>window.__survivalTest.run.state.stats.bonuses===n+1,baseline);
}
async function worldReport(p){return p.evaluate(()=>{
 const v=window.__survivalTest.enemies,camera=v.camera,ce=camera.matrixWorld.elements,normal=[ce[8],ce[9],ce[10]],Vector=camera.position.constructor,Matrix=camera.matrixWorld.constructor;
 const tokens={};
 for(const[type,mesh]of Object.entries(v.pickups)){
  const matrix=new Matrix();mesh.getMatrixAt(0,matrix);matrix.premultiply(mesh.matrixWorld);const a=matrix.elements;
  const length=Math.hypot(a[8],a[9],a[10]),cameraLength=Math.hypot(...normal),dot=(a[8]*normal[0]+a[9]*normal[1]+a[10]*normal[2])/(length*cameraLength);
  const projected=new Vector(a[12],a[13],a[14]).project(camera);
  const vertex=new Vector(),positions=mesh.geometry.attributes.position,bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix).project(camera);const x=(vertex.x*.5+.5)*innerWidth,y=(-.5*vertex.y+.5)*innerHeight;bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);}
  const box=mesh.geometry.boundingBox;
  tokens[type]={count:mesh.count,frontDot:dot,modelSize:[box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z],x:(projected.x*.5+.5)*innerWidth,y:(-.5*projected.y+.5)*innerHeight,depth:projected.z,bounds};
 }
 return{hasRealCamera:!!camera.isPerspectiveCamera,tokens,rings:v.pickupRings.count,calls:window.__survivalTest.renderInfo.calls,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};
});}

function overlap(a,b){return Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;}
async function assertMobileHUD(p,viewport,key){
 const selectors=['#move-stick','#super','#boss-hud','#buffs'];
 const boxes=Object.fromEntries(await Promise.all(selectors.map(async selector=>[selector,await p.locator(selector).boundingBox()])));
 const badges=await p.locator('#buffs .buff-badge').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
 const notification=await p.locator('#notifications').evaluate(n=>{const r=n.getBoundingClientRect();return{visible:n.classList.contains('show'),x:r.x,y:r.y,width:r.width,height:r.height};});
 observations[key]={boxes,badges,notification};
 for(const[name,b]of Object.entries(boxes))assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,name+JSON.stringify(b));
 for(const badge of badges){
  assert.ok(badge.x>=-1&&badge.y>=-1&&badge.x+badge.width<=viewport.width+1&&badge.y+badge.height<=viewport.height+1,JSON.stringify(badge));
  for(const control of ['#move-stick','#super','#boss-hud'])assert.ok(!overlap(badge,boxes[control]),`status overlaps ${control}`);
  if(notification.visible)assert.ok(!overlap(badge,notification),'status overlaps notification');
 }
 for(let i=0;i<badges.length;i++)for(let j=i+1;j<badges.length;j++)assert.ok(!overlap(badges[i],badges[j]),'status badges overlap each other');
}

try{
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
  current=await fresh(viewport,viewport.width!==1280);const p=current.page;
  await check(`${viewport.width}×${viewport.height}: all five physical boosts remain visible in the actual forest arena`,async()=>{
   await arrange(p,{all:true});await p.waitForFunction(()=>Object.values(window.__survivalTest.enemies.pickups).every(mesh=>mesh.count===1));
   const report=await worldReport(p);observations[`${viewport.width}world`]=report;assert.ok(report.hasRealCamera);assert.equal(report.rings,5);assert.equal(report.scrollWidth,viewport.width);
   for(const type of types){const token=report.tokens[type],b=token.bounds;assert.equal(token.count,1,type);assert.ok(token.modelSize.every(n=>n>.20),'boost must have real volume: '+type+JSON.stringify(token));assert.ok(token.x>0&&token.x<viewport.width&&token.y>0&&token.y<viewport.height&&token.depth<1,type+JSON.stringify(token));assert.ok(b.minX>=4&&b.maxX<=viewport.width-4&&b.minY>=4&&b.maxY<=viewport.height-4,`${type} full mesh clipped: ${JSON.stringify(b)}`);}
   await p.screenshot({path:output+`boost-world-${viewport.width}.png`});
  });
  if(viewport.width!==1280){
   await check(`${viewport.width}×${viewport.height}: active boosts and boss HUD leave touch controls clear`,async()=>{
    await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state,p=s.player;s.drops=[];s.enemies=[];s.projectiles=[];s.warnings=[];s.bossId=null;p.invulnerable=999;p.buffs={haste:10,rapid:8,shield:6};p.debuffs={slow:0,poison:0};const b=r._spawnEnemy('boss',-8,-9,null);b.speed=0;b.attackCooldown=b.volleyCooldown=999;s.bossId=b.id;s.elapsed=30;});
    await p.waitForFunction(()=>document.querySelectorAll('#buffs [data-buff]').length===3&&!document.querySelector('#boss-hud').hidden);
    await assertMobileHUD(p,viewport,`boosts${viewport.width}`);await p.screenshot({path:output+`boost-hud-${viewport.width}.png`});
   });
   await check(`${viewport.width}×${viewport.height}: simultaneous slow/poison plus compatible boosts stay readable`,async()=>{
    // Layout fixture only: desktop above proves the real attacks. Shield and
    // debuffs cannot coexist, so test the maximum valid four-status state.
    await p.evaluate(()=>{const p=window.__survivalTest.run.state.player;p.buffs={haste:10,rapid:8,shield:0};p.debuffs={slow:2.5,poison:3};});
    await p.waitForFunction(()=>document.querySelectorAll('#buffs [data-debuff]').length===2&&document.querySelectorAll('#buffs [data-buff]').length===2);
    await assertMobileHUD(p,viewport,`statuses${viewport.width}`);await p.screenshot({path:output+`boost-status-${viewport.width}.png`});
   });
   await current.context.close();current=null;continue;
  }

  await check('Every nearby boost explains its name/effect before a real movement pickup',async()=>{
   observations.collection=[];
   for(const type of types){
    const baseline=await arrange(p,{type,keepBuffs:type!=='heal'});
    const hint=p.locator(`#pickup-hint[data-boost="${type}"]`);await hint.waitFor({state:'visible'});
    assert.equal(await hint.locator('b').textContent(),expected[type][0]);assert.equal(await hint.locator('small').textContent(),expected[type][1]);
    const icon=await hint.locator('img.boost-icon').getAttribute('src');assert.ok(icon.includes(`/boosts/${type}.png`),icon);
    assert.equal((await snapshot(p)).stats.bonuses,baseline.bonuses,'the tooltip must precede collection');
    if(type==='haste')await p.screenshot({path:output+'boost-nearby-hint-1280.png'});
    await walkToCollect(p,baseline.bonuses);const state=await snapshot(p);
    assert.equal(state.stats.bonuses,baseline.bonuses+1);assert.ok(!state.drops.some(d=>d.type===type));
    if(type==='heal')assert.equal(state.player.hp,baseline.hp+25);
    if(type==='magnet'){assert.equal(state.xp,baseline.xp+5);assert.ok(!state.drops.some(d=>d.type==='xp'));}
    if(['haste','rapid','shield'].includes(type)){
     const badge=p.locator(`#buffs [data-buff="${type}"]`);await badge.waitFor({state:'visible'});
     assert.equal(await badge.locator('img.boost-icon').getAttribute('src'),icon,'world hint and HUD must use the same model-rendered icon');
    }
    observations.collection.push({type,tooltip:expected[type].join(' · '),icon,hp:state.player.hp,xp:state.xp});
   }
  });
  await check('Active boost HUD uses readable effects, shared icons and remaining seconds',async()=>{
   const panel=p.locator('#buffs');await p.waitForFunction(()=>document.querySelectorAll('#buffs [data-buff]').length===3);
   for(const[type,summary]of [['haste','+35% к скорости'],['rapid','Темп атаки ×1,67'],['shield','Без урона']]){
    const badge=panel.locator(`[data-buff="${type}"]`);assert.equal(await badge.locator('.buff-copy>small').textContent(),summary);assert.match(await badge.locator('.buff-time').textContent(),/^\d+с$/);
    assert.ok(await badge.locator('img.boost-icon').evaluate(i=>i.complete&&i.naturalWidth>0));
   }
   await p.screenshot({path:output+'boost-hud-1280.png'});
  });
  await check('Real stray arrow and cave-spider bite produce their timed HUD warnings',async()=>{
   await arrange(p);await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.stats.bosses=2;r.state.elapsed=60;const e=r._spawnEnemy('spitter',0,4,'stray');e.speed=0;e.attackCooldown=0;});
   await p.waitForFunction(()=>window.__survivalTest.run.state.player.debuffs.slow>0,null,{timeout:5000});
   await p.locator('#buffs [data-debuff="slow"]').waitFor({state:'visible'});assert.equal(await p.locator('#buffs [data-debuff="slow"] .status-mark').textContent(),'−20%');assert.equal(await p.locator('#buffs [data-debuff="slow"] .buff-copy>small').textContent(),'−20% скорости');
   await p.evaluate(()=>{const r=window.__survivalTest.run;r.state.enemies=[];r.state.projectiles=[];r.state.player.invulnerable=0;r.state.stats.bosses=2;r.state.elapsed=90;const e=r._spawnEnemy('runner',.4,.2,'cave-spider');e.speed=0;});
   await p.waitForFunction(()=>window.__survivalTest.run.state.player.debuffs.poison>0);
   await p.locator('#buffs [data-debuff="poison"]').waitFor({state:'visible'});assert.equal(await p.locator('#buffs [data-debuff="poison"] .status-mark').textContent(),'2/с');assert.equal(await p.locator('#buffs [data-debuff="poison"] .buff-copy>small').textContent(),'−2 здоровья/с');
   assert.equal(await p.locator('#hud').getAttribute('data-poisoned'),'true');assert.equal(await p.locator('#hud').getAttribute('data-slowed'),'true');
   await p.evaluate(()=>{const s=window.__survivalTest.run.state;s.enemies=[];s.projectiles=[];});
   await p.screenshot({path:output+'boost-status-1280.png'});
  });
  await check('Pause freezes active poison/slow timers and remaining health',async()=>{
   await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='paused');
   const a=await snapshot(p);await p.waitForTimeout(350);const b=await snapshot(p);assert.deepEqual(b.player.debuffs,a.player.debuffs);assert.equal(b.player.hp,a.player.hp);assert.ok(a.player.debuffs.poison>0&&a.player.debuffs.slow>0);
   observations.frozenStatus={debuffs:a.player.debuffs,hp:a.player.hp};await p.locator('#start').click();await p.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='playing');
  });
  await check('Collecting a shield in the arena removes both status badges and their HUD flags',async()=>{
   const baseline=await p.evaluate(()=>{const r=window.__survivalTest.run,s=r.state,p=s.player;s.enemies=[];s.projectiles=[];p.invulnerable=0;s.drops=[{id:94000,type:'shield',x:p.x+1,z:p.z,life:20,value:0,radius:.3}];return s.stats.bonuses;});
   await walkToCollect(p,baseline);await p.waitForFunction(()=>!document.querySelector('#buffs [data-debuff]'));
   const state=await snapshot(p);assert.deepEqual(state.player.debuffs,{slow:0,poison:0});assert.ok(state.player.buffs.shield>0);
   assert.equal(await p.locator('#hud').getAttribute('data-poisoned'),'false');assert.equal(await p.locator('#hud').getAttribute('data-slowed'),'false');
   await p.screenshot({path:output+'boost-shield-cleansed-1280.png'});
  });
  await current.context.close();current=null;
 }
 await check('No browser or GPU shader errors',()=>assert.deepEqual(errors,[]));
}finally{
 await current?.context.close();await browser.close();await writeFile(output+'boost-gameplay-results.json',JSON.stringify({results,errors,observations},null,2));
}
const summary={passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors};console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
