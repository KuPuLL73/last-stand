import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[],images={};page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5190/game/artifacts/steve-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
const metrics=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js'),{steve:s}=window.__stevePreview;
 s.reset();s.root.updateMatrixWorld(true);
 const arm=s.root.getObjectByName('RightArm'),local=new THREE.Vector3(-4.5*1.85/32,-4.5*1.85/32,0).applyMatrix4(s.sword.matrix);
 const base=s.sword.matrix.toArray(),armBounds={x:[-3,1],y:[-10,-6],z:[-2,2]},unit=1.85/32;
 const grip=local.toArray().map(v=>v/unit);const contact=grip[0]>=-3&&grip[0]<=1&&grip[1]>=-10&&grip[1]<=-6&&grip[2]>=-2&&grip[2]<=2;
 const modes=[];for(const age of [0,.04,.07,.10,.14,.20,.25,.34,.43,.8]){s.reset();s.attack();s.update(age,{bowActive:false});s.root.updateMatrixWorld(true);const tip=new THREE.Vector3(6.5*unit,6.5*unit,0).applyMatrix4(s.sword.matrixWorld);modes.push({age,mount:s.sword.matrix.toArray(),elbow:s.root.getObjectByName('RightArmElbow').quaternion.toArray(),tip:tip.toArray()});}
 s.reset();s.update(0,{bowActive:true});s.root.updateMatrixWorld(true);const bow=s.bow.children.find(x=>x.visible),forward=new THREE.Vector3(-1,1,0).transformDirection(bow.matrixWorld).toArray();
 const rightArm=s.root.getObjectByName('RightArm').rotation.toArray(),leftArm=s.root.getObjectByName('LeftArm').rotation.toArray();
 const age=s.root.userData.attackAge;s.update(0,{bowActive:true});const frozen=s.root.userData.attackAge===age;
 return{gripPixels:grip,contact,base,modes,arrowForward:forward,rightArm,leftArm,frozen,shoulder:arm.position.toArray().map(v=>v/unit)};
});
assert.ok(metrics.contact,JSON.stringify(metrics.gripPixels));assert.deepEqual(metrics.shoulder,[-5,22,0]);assert.ok(metrics.arrowForward[2]>.97);assert.ok(metrics.frozen);
for(const m of metrics.modes){assert.deepEqual(m.mount,metrics.base,'Item drifted in the hand during slash');assert.deepEqual(m.elbow,[0,0,0,1],'Minecraft arm bent at an elbow');}
const cut=metrics.modes.filter(m=>m.age>=.07&&m.age<=.20),angles=cut.map(m=>Math.atan2(m.tip[0],m.tip[2])*180/Math.PI),heights=cut.map(m=>m.tip[1]);
assert.ok(Math.max(...angles)-Math.min(...angles)>110,'Sword must sweep broadly across the front');assert.ok(Math.max(...heights)-Math.min(...heights)<.08,'Sword cut should stay horizontal');
for(const [name,camera,bow,age]of [
 ['sword-front',[0,1.8,5.7],false,null],['sword-profile',[5.7,1.8,0],false,null],['sword-three-quarter',[3.3,2.75,5.2],false,null],
 ['sword-windup',[3.3,2.75,5.2],false,.07],['sword-impact',[3.3,2.75,5.2],false,.14],['sword-followthrough',[3.3,2.75,5.2],false,.20],['bow-front',[0,1.8,5.7],true,null],['bow-profile',[5.7,1.8,0],true,null],['bow-three-quarter',[3.3,2.75,5.2],true,null],['bow-release',[3.3,2.75,5.2],true,.02]
]){await page.evaluate(({camera,bow,age})=>{const p=window.__stevePreview;p.steve.reset();p.mode(bow);p.setFrozen(true);p.setCamera(...camera);if(age!==null)p.pose(age,bow);}, {camera,bow,age});await page.waitForTimeout(100);images[name]=await page.screenshot();}
await browser.close();for(const[name,data]of Object.entries(images))await writeFile(`game/artifacts/steve-fidelity-${name}.png`,data);await writeFile('game/artifacts/steve-fidelity-check.json',JSON.stringify({metrics,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({contact:metrics.contact,gripPixels:metrics.gripPixels,arrowForward:metrics.arrowForward,images:Object.keys(images),errors}));
