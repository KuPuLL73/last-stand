import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack});console.log('FAIL',name,error.message);}};
try{
 await page.goto('http://127.0.0.1:5190/game/artifacts/extra-arsenal-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await check('two original item models equip without falling back to the wooden sword',async()=>{
  const models=await page.evaluate(()=>window.__extraArsenal.models.map(m=>({id:m.weaponId,held:m.root.userData.heldWeapon,ranged:m.root.userData.rangedActive,key:m.sword.userData.itemPixelKey,visible:m.sword.visible})));
  assert.deepEqual(models.map(m=>m.id),['snow-caster','tide-trident']);assert.ok(models.every(m=>m.ranged&&m.visible&&m.held===m.id));assert.deepEqual(models.map(m=>m.key),['snowball','thrown-trident']);
 });await page.screenshot({path:'game/artifacts/extra-arsenal-held.png'});
 await check('throw release uses overhead arms and visible original-pixel snowball/trident projectiles',async()=>{
  await page.evaluate(()=>window.__extraArsenal.render('throw'));
  const state=await page.evaluate(()=>{const f=window.__extraArsenal;return{models:f.models.map(m=>({held:m.sword.visible,kind:m.root.userData.attackKind,armX:m.root.getObjectByName('RightArm').rotation.x})),projectiles:f.shots.map(m=>({visible:m.visible,vertices:m.geometry.attributes.position.count,colour:m.geometry.attributes.color.count}))};});
  assert.ok(state.models.every(m=>!m.held&&m.kind==='ranged'&&m.armX<-.5));assert.ok(state.projectiles.every(p=>p.visible&&p.vertices>100&&p.colour===p.vertices));
 });await page.screenshot({path:'game/artifacts/extra-arsenal-throw.png'});
 await check('no runtime, texture or GLSL errors',()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile('game/artifacts/extra-arsenal-results.json',JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,errors}));if(results.some(r=>!r.ok))process.exitCode=1;
