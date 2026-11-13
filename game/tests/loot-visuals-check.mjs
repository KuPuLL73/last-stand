import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1360,height:800},locale:'ru-RU'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/game/artifacts/loot-preview.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const report=await page.evaluate(()=>{
  const {visual,drawCalls}=window.__lootPreview;
  return {gems:visual.gems.count,shine:visual.gemShines.count,bonuses:Object.fromEntries(Object.entries(visual.pickups).map(([k,v])=>[k,v.count])),rings:visual.pickupRings.count,drawCalls:drawCalls()};
 });
 assert.equal(report.gems,3);assert.equal(report.shine,3);assert.equal(report.rings,5);
 for(const type of ['heal','haste','rapid','shield','magnet'])assert.equal(report.bonuses[type],1);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:dir+'loot-preview.png'});
 await writeFile(dir+'loot-visuals-results.json',JSON.stringify({passed:true,...report,errors},null,2));
 console.log(JSON.stringify({passed:true,...report,errors},null,2));
}finally{await browser.close();}
