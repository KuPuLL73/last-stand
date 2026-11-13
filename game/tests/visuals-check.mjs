import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1400,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto('http://127.0.0.1:5190/game/artifacts/survival-visuals-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.screenshot({path:fileURLToPath(new URL('../artifacts/survival-enemies-preview.png',import.meta.url))});assert.deepEqual(errors,[]);console.log('PASS enemy batches and warning geometry render without errors');}finally{await browser.close();}
