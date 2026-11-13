import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
async function paint(){await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode()));await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
try{
 await mkdir('reference/upgrade-redesign',{recursive:true});
 await page.goto('http://127.0.0.1:5190/game/artifacts/upgrade-gallery.html');await page.waitForFunction(()=>window.__upgradeGalleryReady);await paint();
 assert.equal(await page.locator('.upgrade-choice').count(),15);assert.equal(await page.locator('#boost-list article').count(),5);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1600);
 await page.locator('main').screenshot({path:'reference/upgrade-redesign/all-upgrades-and-boosts.png'});
 await page.locator('#upgrade-choices').screenshot({path:'reference/upgrade-redesign/all-upgrades.png'});
 await page.locator('#boost-overview').screenshot({path:'reference/upgrade-redesign/all-boosts.png'});
 await page.goto('http://127.0.0.1:5190/game/artifacts/upgrade-comparison.html');await page.locator('.upgrade-choice').first().waitFor();await paint();
 await page.screenshot({path:'game/artifacts/upgrade-gemini-comparison.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile('game/artifacts/upgrade-review-capture.json',JSON.stringify({viewport:{width:1600,height:1100},deviceScaleFactor:1,artworks:15,boosts:5,errors},null,2));
 console.log('Captured all 15 upgrade illustrations, 5 boosts, and source comparison; no browser errors.');
}finally{await browser.close();}
