import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const output=new URL('../../reference/gemini-brief/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:2400,height:1300},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5190/game/artifacts/gemini-reference-sheet.html');await page.waitForFunction(()=>window.__referenceSheet?.ready);
 const data=await page.evaluate(()=>{const r=window.__referenceSheet;return{upgradeIds:r.upgradeIds,boostIds:r.boostIds,variants:r.variants,boosts:r.boosts,cards:[...document.querySelectorAll('.upgrade,.boost')].map(e=>({id:e.dataset.upgrade||e.dataset.boost,box:e.getBoundingClientRect().toJSON(),overflow:e.scrollWidth>e.clientWidth+1})),textOverflow:[...document.querySelectorAll('h1,h2,.variant p,.intro,.boost-effect,.boost-note')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)};});
 assert.equal(data.upgradeIds.length,10);assert.equal(data.boostIds.length,5);assert.equal(data.cards.length,15);assert.ok(data.cards.every(c=>!c.overflow));assert.deepEqual(data.textOverflow,[]);assert.deepEqual(errors,[]);
 for(const [selector,file]of [['#upgrades','current-upgrades.png'],['#boosts','current-boosts.png'],['main','current-upgrades-and-boosts.png']])await page.locator(selector).screenshot({path:fileURLToPath(new URL(file,output))});
 await writeFile(new URL('reference-sheet-data.json',output),JSON.stringify({generatedAt:new Date().toISOString(),...data,errors},null,2));
 console.log(JSON.stringify({output:fileURLToPath(output),upgrades:data.upgradeIds,boosts:data.boostIds,errors}));
}finally{await browser.close();}
