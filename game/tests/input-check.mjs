import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const dir=fileURLToPath(new URL('../artifacts/',import.meta.url));await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});const errors=[],results=[];
const state=p=>p.locator('#hud').evaluate(e=>({...e.dataset,x:Number(e.dataset.x),z:Number(e.dataset.z),shots:Number(e.dataset.shots),hits:Number(e.dataset.hits)}));
async function fresh(options={}){const context=await browser.newContext({viewport:{width:1000,height:700},locale:'ru-RU',...options});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5190/play.html');await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});await page.locator('#start').click();return{context,page};}
try{
 const desktop=await fresh();const p=desktop.page;await p.mouse.move(500,180);await p.mouse.down();await p.waitForFunction(()=>Number(document.querySelector('#hud').dataset.hits)>0,null,{timeout:15000});await p.mouse.up();await p.waitForTimeout(200);const a=await state(p);assert.ok(a.shots>0&&a.hits>0);await p.waitForTimeout(600);assert.equal((await state(p)).shots,a.shots);results.push('Mouse aim + held LMB: hits and no continued firing after release');await desktop.context.close();
 const mobile=await fresh({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const m=mobile.page,cdp=await mobile.context.newCDPSession(m);
 await m.evaluate(()=>{window.__touchEvents=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,e=>window.__touchEvents.push({type:e.type,id:e.pointerId,target:e.target.id,x:e.clientX,y:e.clientY}),true);});
 const left=await m.locator('#move-stick').boundingBox(),right=await m.locator('#fire-stick').boundingBox();
 const movement={x:left.x+left.width/2,y:left.y+left.height*.18,id:0,radiusX:4,radiusY:4,force:1},fire={x:right.x+right.width/2,y:right.y+right.height/2,id:1,radiusX:4,radiusY:4,force:1};
 const start=await state(m);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[movement]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[movement,fire]});
 await m.waitForFunction(()=>Number(document.querySelector('#hud').dataset.z)<7&&Number(document.querySelector('#hud').dataset.shots)>0,null,{timeout:15000});const both=await state(m);assert.ok(both.z<start.z-.5&&both.shots>start.shots,JSON.stringify({start,both}));results.push('Two simultaneous touch pointers: walk and fire together');
 // Chromium treats nonempty touchEnd points as the pointers being released.
 // Explicitly release the fire pointer while preserving the move pointer.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[fire]});await m.waitForTimeout(250);const one=await state(m);await m.waitForTimeout(1500);const moving=await state(m);
 const events=await m.evaluate(()=>window.__touchEvents);await writeFile(dir+'touch-event-trace.json',JSON.stringify({start,both,one,moving,events},null,2));
 assert.ok(moving.z<one.z-.3,JSON.stringify({one,moving,events}));assert.equal(moving.shots,one.shots);results.push('Releasing only fire finger keeps movement and stops firing');
 // Change to a clear horizontal lane so a cover collision cannot conceal stuck input.
 const turn={...movement,x:left.x+left.width*.82,y:left.y+left.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[turn]});
 await m.waitForFunction(()=>Number(document.querySelector('#hud').dataset.x)>.5,null,{timeout:10000});const turning=await state(m);assert.ok(turning.x>.5);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await m.waitForTimeout(220);const stopped=await state(m);await m.waitForTimeout(600);const afterCancel=await state(m);assert.ok(Math.abs(afterCancel.x-stopped.x)<.02&&Math.abs(afterCancel.z-stopped.z)<.02,JSON.stringify({turning,stopped,afterCancel}));results.push('Touch move changes direction; touch cancel stops it in a clear lane');
 const completeEvents=await m.evaluate(()=>window.__touchEvents);assert.ok(completeEvents.some(e=>e.type==='pointercancel'&&e.target==='move-stick'));await writeFile(dir+'touch-event-trace.json',JSON.stringify({start,both,one,moving,turning,stopped,afterCancel,events:completeEvents},null,2));
 await m.screenshot({path:dir+'mobile-input.png'});await mobile.context.close();assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(dir+'input-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({results,errors},null,2));
