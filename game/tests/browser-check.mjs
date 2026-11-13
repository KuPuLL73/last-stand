import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const artifacts=fileURLToPath(new URL('../artifacts/',import.meta.url));
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];
const hud=page=>page.locator('#hud').evaluate(el=>Object.fromEntries(Object.entries(el.dataset).map(([k,v])=>[k,['active'].includes(k)?v:Number(v)])));
async function fresh(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/play.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#hud').dataset.active==='true');
 return {page,context};
}
async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(160);}
async function holdUntil(page,key,predicate){await page.keyboard.down(key);try{await page.waitForFunction(predicate,null,{timeout:20000});}finally{await page.keyboard.up(key);}await page.waitForTimeout(180);}
async function touchHold(page,x,y,ms){const cdp=await page.context().newCDPSession(page);try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0,radiusX:4,radiusY:4,force:1}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}await page.waitForTimeout(180);}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
let main;
try{
 main=await fresh(); const page=main.page;
 await check('ready, inactive before gesture, active after start',async()=>{const s=await hud(page);assert.equal(s.active,'true');assert.equal(s.x,0);assert.equal(s.z,7.5);assert.equal(s.ammo,3);});
 await check('WASD and arrow controls move in intended axes',async()=>{const a=await hud(page);await hold(page,'w',360);const b=await hud(page);assert.ok(b.z<a.z-.5);assert.ok(Math.abs(b.x-a.x)<.01);await hold(page,'ArrowRight',360);const c=await hud(page);assert.ok(c.x>b.x+.5);await hold(page,'s',360);const d=await hud(page);assert.ok(d.z>c.z+.5);await hold(page,'ArrowLeft',360);const e=await hud(page);assert.ok(e.x<d.x-.5);});
 await check('Space tap fires once and automatically reloads',async()=>{await hold(page,'Space',130);const fired=await hud(page);assert.equal(fired.shots,1);assert.equal(fired.ammo,2);await page.waitForFunction(()=>Number(document.querySelector('#hud').dataset.ammo)===3,null,{timeout:12000});});
 await check('Space hold fires repeatedly and reaches target damage / destruction',async()=>{await holdUntil(page,'Space',()=>Number(document.querySelector('#hud').dataset.kills)>0&&Number(document.querySelector('#hud').dataset.shots)>=5);const s=await hud(page);assert.ok(s.shots>=5,JSON.stringify(s));assert.ok(s.hits>0,JSON.stringify(s));assert.ok(s.kills>0,JSON.stringify(s));});
 await page.screenshot({path:artifacts+'desktop-range.png'});
 await check('Escape freezes movement and clears held keys before resume',async()=>{await page.keyboard.down('d');await page.waitForTimeout(240);await page.keyboard.press('Escape');await page.waitForTimeout(200);const a=await hud(page);await page.waitForTimeout(600);const b=await hud(page);assert.equal(a.x,b.x);assert.equal(a.z,b.z);await page.keyboard.up('d');await page.locator('#start').click();await page.waitForTimeout(500);const c=await hud(page);assert.ok(Math.abs(c.x-b.x)<.015);assert.ok(Math.abs(c.z-b.z)<.015);assert.equal(c.active,'true');});
 await check('Holding fire across pause cannot leave autofire stuck on resume',async()=>{await page.keyboard.down('Space');await page.waitForTimeout(240);await page.keyboard.press('Escape');await page.keyboard.up('Space');const paused=await hud(page);await page.waitForTimeout(500);assert.equal((await hud(page)).shots,paused.shots);await page.locator('#start').click();await page.waitForTimeout(600);assert.equal((await hud(page)).shots,paused.shots);});
 await check('Arena right edge blocks repeated movement',async()=>{await holdUntil(page,'d',()=>Number(document.querySelector('#hud').dataset.x)>=10.86);const s=await hud(page);assert.ok(s.x<=10.871,JSON.stringify(s));assert.ok(s.x>=10.7,JSON.stringify(s));await hold(page,'d',500);const again=await hud(page);assert.ok(Math.abs(s.x-again.x)<.005);});
 await main.context.close();main=null;
 const cover=await fresh();
 await check('Cover has solid collision at its visible front face',async()=>{const p=cover.page;await holdUntil(p,'a',()=>Number(document.querySelector('#hud').dataset.x)<=-3.98);await holdUntil(p,'w',()=>Number(document.querySelector('#hud').dataset.z)<=3.86);const a=await hud(p);assert.ok(a.x<-3.7&&a.x>-4.4,JSON.stringify(a));assert.ok(a.z>=3.853&&a.z<4.1,JSON.stringify(a));await hold(p,'w',700);const b=await hud(p);assert.ok(Math.abs(a.z-b.z)<.02,JSON.stringify({a,b}));});
 await cover.context.close();
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const mobile=await fresh({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1});const p=mobile.page;
  await check(`${viewport.width}×${viewport.height}: touch movement and release`,async()=>{assert.ok(await p.locator('#move-stick').isVisible());const r=await p.locator('#move-stick').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height,JSON.stringify(r));const a=await hud(p);await touchHold(p,r.x+r.width/2,r.y+r.height*.18,900);const b=await hud(p);assert.ok(b.z<a.z-.5,JSON.stringify({a,b}));await p.waitForTimeout(400);const c=await hud(p);assert.ok(Math.abs(b.z-c.z)<.02);});
  await check(`${viewport.width}×${viewport.height}: touch fire and release`,async()=>{const r=await p.locator('#fire-stick').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height,JSON.stringify(r));const a=await hud(p);await touchHold(p,r.x+r.width/2,r.y+r.height/2,1400);const b=await hud(p);assert.ok(b.shots>a.shots);assert.ok(b.hits>a.hits,JSON.stringify({a,b}));await p.waitForTimeout(500);assert.equal((await hud(p)).shots,b.shots);});
  await check(`${viewport.width}×${viewport.height}: no document overflow`,async()=>{const d=await p.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));assert.ok(d.scrollWidth<=d.width+1,JSON.stringify(d));assert.ok(d.scrollHeight<=d.height+1,JSON.stringify(d));});
  await p.screenshot({path:artifacts+`touch-${viewport.width}x${viewport.height}.png`});await mobile.context.close();
 }
 await check('No uncaught page errors',()=>assert.deepEqual(errors,[]));
}finally{
 await main?.context.close();await browser.close();
 await writeFile(artifacts+'browser-results.json',JSON.stringify({results,errors},null,2));
}
console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,errors},null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
