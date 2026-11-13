import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1,locale:'ru-RU'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await context.addInitScript(()=>localStorage.setItem('survival-character','shelly'));
   await page.goto('http://127.0.0.1:5190/survival.html');await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});await page.locator('#start').tap();await page.waitForFunction(()=>document.querySelector('#hud').dataset.phase==='playing');
   await page.evaluate(()=>{const r=window.__survivalTest.run,s=r.state,p=s.player;r._spawnClock=999;s.enemies=[];s.drops=[];p.invulnerable=999;p.buffs={haste:10,rapid:8,shield:6};for(const k of Object.keys(s.upgrades))s.upgrades[k]=1;r._spawnBoss();});
   await page.waitForFunction(()=>document.querySelector('#notifications').classList.contains('show')&&document.querySelectorAll('.buff-badge').length===3&&document.querySelectorAll('.build-chip').length===10);await page.waitForTimeout(200);
   const selectors=['#notifications','#buffs','#boss-hud','#move-stick','#super','.build-panel'];const boxes=Object.fromEntries(await Promise.all(selectors.map(async s=>[s,await page.locator(s).boundingBox()])));
   for(const selector of selectors.slice(1))assert.ok(!overlap(boxes['#notifications'],boxes[selector]),`${viewport.width}: toast intersects ${selector}: ${JSON.stringify(boxes)}`);
   const n=boxes['#notifications'];assert.ok(n.x>=0&&n.y>=0&&n.x+n.width<=viewport.width+1&&n.y+n.height<=viewport.height+1,JSON.stringify(n));
   await page.screenshot({path:dir+`survival-v3-buffs-${viewport.width}.png`});results.push({viewport,ok:true,boxes});console.log(`PASS ${viewport.width}×${viewport.height}: toast avoids buffs, boss HUD and controls`);
  }catch(error){results.push({viewport,ok:false,error:error.message});console.log('FAIL',error.message);}finally{await context.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(dir+'survival-toast-layout-results.json',JSON.stringify({results,errors},null,2));}
if(results.some(r=>!r.ok))process.exitCode=1;
